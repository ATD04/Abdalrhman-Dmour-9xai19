// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
    University Election - Phase 1 (Blockchain only, ZKP-ready structure)

    Current authorization model:
    - Off-chain backend verifies student eligibility
    - Backend signs (contract, chainId, electionId, voterWallet)
    - Smart contract checks signature in vote()

    Later ZKP upgrade:
    - Keep election management, candidate management, and _recordVote()
    - Replace signature authorization with proof verification + nullifier logic
    - Frontend/backend mostly keep same election flow, only vote authorization changes
*/

contract UniversityElection {
    address public owner;
    address public admin2;
    address public eligibilitySigner;

    uint256 public electionCount;

    struct Admin2Permissions {
        bool active;
        bool canManageCandidates;
        bool canViewLiveResults;
    }

    struct Election {
        uint256 id;
        string title;
        uint256 startTime;
        uint256 endTime;
        bool isOpen;
        bool isFinalized;
        bool exists;
        uint256 totalCandidateCount;
        uint256 activeCandidateCount;
        uint256 totalVotes;
    }

    struct Candidate {
        uint256 id;
        string name;
        string slogan;
        string imageUrl;
        string achievements;
        string goals;
        uint256 voteCount;
        bool exists;
        bool isActive;
    }

    Admin2Permissions public admin2Permissions;

    mapping(uint256 => Election) private elections;
    mapping(uint256 => mapping(uint256 => Candidate)) private candidates;
    mapping(uint256 => uint256[]) private candidateIdsByElection;

    // Phase 1 anti-double-vote model: one wallet per election
    // Later in ZKP phase, this can be replaced or supplemented with nullifier-based logic
    mapping(uint256 => mapping(address => bool)) private hasVotedByWallet;

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    event Admin2Configured(
        address indexed admin2,
        bool canManageCandidates,
        bool canViewLiveResults
    );

    event Admin2Revoked(address indexed oldAdmin2);

    event EligibilitySignerUpdated(address indexed newSigner);

    event ElectionCreated(
        uint256 indexed electionId,
        string title,
        uint256 startTime,
        uint256 endTime
    );

    event ElectionTimesUpdated(
        uint256 indexed electionId,
        uint256 startTime,
        uint256 endTime
    );

    event ElectionOpened(uint256 indexed electionId);
    event ElectionClosed(uint256 indexed electionId);
    event ElectionFinalized(uint256 indexed electionId);

    event CandidateAdded(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string name
    );

    event CandidateUpdated(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        string name
    );

    event CandidateDeleted(
        uint256 indexed electionId,
        uint256 indexed candidateId
    );

    // Intentionally does NOT emit voter wallet address
    event VoteRecorded(
        uint256 indexed electionId,
        uint256 indexed candidateId,
        uint256 candidateVoteCount,
        uint256 totalVotes
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only Admin1 can do this");
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(elections[_electionId].exists, "Election does not exist");
        _;
    }

    modifier onlyCandidateManagers() {
        require(
            msg.sender == owner ||
                (
                    msg.sender == admin2 &&
                    admin2Permissions.active &&
                    admin2Permissions.canManageCandidates
                ),
            "No candidate management permission"
        );
        _;
    }

    modifier onlyLiveResultViewers() {
        require(
            msg.sender == owner ||
                (
                    msg.sender == admin2 &&
                    admin2Permissions.active &&
                    admin2Permissions.canViewLiveResults
                ),
            "No live result access"
        );
        _;
    }

    modifier onlyBeforeVotingStarts(uint256 _electionId) {
        Election storage e = elections[_electionId];
        require(!e.isFinalized, "Election finalized");
        require(!e.isOpen, "Election already opened");
        require(block.timestamp < e.startTime, "Voting window already started");
        require(e.totalVotes == 0, "Votes already recorded");
        _;
    }

    constructor(address _eligibilitySigner) {
        require(_eligibilitySigner != address(0), "Invalid signer");
        owner = msg.sender;
        eligibilitySigner = _eligibilitySigner;
    }

    // =========================
    // Admin / Ownership
    // =========================

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner");
        require(_newOwner != owner, "Already owner");

        address oldOwner = owner;
        owner = _newOwner;

        emit OwnershipTransferred(oldOwner, _newOwner);
    }

    function configureAdmin2(
        address _admin2,
        bool _canManageCandidates,
        bool _canViewLiveResults
    ) external onlyOwner {
        require(_admin2 != address(0), "Invalid admin2");
        require(_admin2 != owner, "Admin2 must differ from Admin1");

        admin2 = _admin2;
        admin2Permissions = Admin2Permissions({
            active: true,
            canManageCandidates: _canManageCandidates,
            canViewLiveResults: _canViewLiveResults
        });

        emit Admin2Configured(
            _admin2,
            _canManageCandidates,
            _canViewLiveResults
        );
    }

    function revokeAdmin2() external onlyOwner {
        address oldAdmin2 = admin2;
        admin2 = address(0);
        delete admin2Permissions;

        emit Admin2Revoked(oldAdmin2);
    }

    function setEligibilitySigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        eligibilitySigner = _signer;

        emit EligibilitySignerUpdated(_signer);
    }

    // =========================
    // Election Management
    // =========================

    function createElection(
        string memory _title,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyOwner returns (uint256) {
        require(bytes(_title).length > 0, "Title is required");
        require(_startTime > block.timestamp, "Start time must be in future");
        require(_startTime < _endTime, "Invalid time range");

        electionCount++;

        elections[electionCount] = Election({
            id: electionCount,
            title: _title,
            startTime: _startTime,
            endTime: _endTime,
            isOpen: false,
            isFinalized: false,
            exists: true,
            totalCandidateCount: 0,
            activeCandidateCount: 0,
            totalVotes: 0
        });

        emit ElectionCreated(electionCount, _title, _startTime, _endTime);
        return electionCount;
    }

    function updateElectionTimes(
        uint256 _electionId,
        uint256 _startTime,
        uint256 _endTime
    )
        external
        onlyOwner
        electionExists(_electionId)
        onlyBeforeVotingStarts(_electionId)
    {
        require(_startTime > block.timestamp, "Start time must be in future");
        require(_startTime < _endTime, "Invalid time range");

        Election storage e = elections[_electionId];
        e.startTime = _startTime;
        e.endTime = _endTime;

        emit ElectionTimesUpdated(_electionId, _startTime, _endTime);
    }

    function openElection(uint256 _electionId)
        external
        onlyOwner
        electionExists(_electionId)
    {
        Election storage e = elections[_electionId];

        require(!e.isFinalized, "Election finalized");
        require(!e.isOpen, "Election already open");
        require(e.activeCandidateCount > 0, "Add active candidates first");
        require(block.timestamp < e.endTime, "Election already expired");

        e.isOpen = true;

        emit ElectionOpened(_electionId);
    }

    function closeElection(uint256 _electionId)
        external
        onlyOwner
        electionExists(_electionId)
    {
        Election storage e = elections[_electionId];

        require(e.isOpen, "Election already closed");
        require(!e.isFinalized, "Election finalized");

        e.isOpen = false;

        emit ElectionClosed(_electionId);
    }

    function finalizeElection(uint256 _electionId)
        external
        electionExists(_electionId)
    {
        Election storage e = elections[_electionId];

        require(!e.isFinalized, "Already finalized");
        require(
            !e.isOpen || block.timestamp > e.endTime || msg.sender == owner,
            "Not allowed to finalize yet"
        );

        e.isOpen = false;
        e.isFinalized = true;

        emit ElectionFinalized(_electionId);
    }

    // =========================
    // Candidate Management
    // =========================

    function addCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _slogan,
        string memory _imageUrl,
        string memory _achievements,
        string memory _goals
    )
        external
        onlyCandidateManagers
        electionExists(_electionId)
        onlyBeforeVotingStarts(_electionId)
        returns (uint256)
    {
        require(bytes(_name).length > 0, "Candidate name is required");

        Election storage e = elections[_electionId];
        e.totalCandidateCount++;

        uint256 candidateId = e.totalCandidateCount;

        candidates[_electionId][candidateId] = Candidate({
            id: candidateId,
            name: _name,
            slogan: _slogan,
            imageUrl: _imageUrl,
            achievements: _achievements,
            goals: _goals,
            voteCount: 0,
            exists: true,
            isActive: true
        });

        candidateIdsByElection[_electionId].push(candidateId);
        e.activeCandidateCount++;

        emit CandidateAdded(_electionId, candidateId, _name);
        return candidateId;
    }

    function updateCandidate(
        uint256 _electionId,
        uint256 _candidateId,
        string memory _name,
        string memory _slogan,
        string memory _imageUrl,
        string memory _achievements,
        string memory _goals
    )
        external
        onlyCandidateManagers
        electionExists(_electionId)
        onlyBeforeVotingStarts(_electionId)
    {
        Candidate storage c = candidates[_electionId][_candidateId];

        require(c.exists, "Candidate does not exist");
        require(c.isActive, "Candidate not active");
        require(bytes(_name).length > 0, "Candidate name is required");

        c.name = _name;
        c.slogan = _slogan;
        c.imageUrl = _imageUrl;
        c.achievements = _achievements;
        c.goals = _goals;

        emit CandidateUpdated(_electionId, _candidateId, _name);
    }

    function deleteCandidate(
        uint256 _electionId,
        uint256 _candidateId
    )
        external
        onlyCandidateManagers
        electionExists(_electionId)
        onlyBeforeVotingStarts(_electionId)
    {
        Candidate storage c = candidates[_electionId][_candidateId];

        require(c.exists, "Candidate does not exist");
        require(c.isActive, "Candidate already inactive");

        c.name = "";
        c.slogan = "";
        c.imageUrl = "";
        c.achievements = "";
        c.goals = "";
        c.voteCount = 0;
        c.exists = false;
        c.isActive = false;

        elections[_electionId].activeCandidateCount--;

        emit CandidateDeleted(_electionId, _candidateId);
    }

    // =========================
    // Voting
    // =========================

    /*
        ZKP-ready design note:
        This function currently uses signature authorization.
        Later, add a new voteWithProof(...) function that:
        - verifies ZKP
        - checks/consumes a nullifier
        - then calls _recordVote(_electionId, _candidateId)

        That way, election logic and vote-recording logic stay reusable.
    */
    function vote(
        uint256 _electionId,
        uint256 _candidateId,
        bytes calldata _eligibilitySignature
    ) external electionExists(_electionId) {
        _beforeVoteChecks(_electionId, _candidateId);

        require(
            !hasVotedByWallet[_electionId][msg.sender],
            "This wallet already voted"
        );

        require(
            _isValidEligibilitySignature(
                _electionId,
                msg.sender,
                _eligibilitySignature
            ),
            "Invalid eligibility signature"
        );

        hasVotedByWallet[_electionId][msg.sender] = true;

        _recordVote(_electionId, _candidateId);
    }

    function _beforeVoteChecks(
        uint256 _electionId,
        uint256 _candidateId
    ) internal view {
        Election storage e = elections[_electionId];
        Candidate storage c = candidates[_electionId][_candidateId];

        require(_isElectionAcceptingVotes(e), "Election is not accepting votes");
        require(c.exists, "Candidate does not exist");
        require(c.isActive, "Candidate is not active");
    }

    function _recordVote(
        uint256 _electionId,
        uint256 _candidateId
    ) internal {
        Election storage e = elections[_electionId];
        Candidate storage c = candidates[_electionId][_candidateId];

        c.voteCount++;
        e.totalVotes++;

        emit VoteRecorded(
            _electionId,
            _candidateId,
            c.voteCount,
            e.totalVotes
        );
    }

    // =========================
    // Election Getters
    // =========================

    function getElectionMeta(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (
            uint256 id,
            string memory title,
            uint256 startTime,
            uint256 endTime,
            bool isOpen,
            bool isFinalized
        )
    {
        Election storage e = elections[_electionId];
        return (
            e.id,
            e.title,
            e.startTime,
            e.endTime,
            e.isOpen,
            e.isFinalized
        );
    }

    /*
        Phase values:
        0 = Draft
        1 = Scheduled
        2 = Active
        3 = Closed/Ended
        4 = Finalized
    */
    function getElectionPhase(uint256 _electionId)
        public
        view
        electionExists(_electionId)
        returns (uint8)
    {
        Election storage e = elections[_electionId];

        if (e.isFinalized) {
            return 4;
        }

        if (!e.isOpen) {
            if (block.timestamp < e.startTime && e.totalVotes == 0) {
                return 0;
            }
            return 3;
        }

        if (block.timestamp < e.startTime) {
            return 1;
        }

        if (block.timestamp <= e.endTime) {
            return 2;
        }

        return 3;
    }

    function isElectionAcceptingVotes(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (bool)
    {
        Election storage e = elections[_electionId];
        return _isElectionAcceptingVotes(e);
    }

    function arePublicResultsVisible(uint256 _electionId)
        public
        view
        electionExists(_electionId)
        returns (bool)
    {
        Election storage e = elections[_electionId];
        return _canPublicSeeResults(e);
    }

    function getElectionPublicStats(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (
            uint8 phase,
            uint256 activeCandidateCount,
            uint256 publicTotalVotes,
            bool publicResultsVisible
        )
    {
        Election storage e = elections[_electionId];
        bool visible = _canPublicSeeResults(e);
        uint256 votes = visible ? e.totalVotes : 0;
        uint8 currentPhase = getElectionPhase(_electionId);

        return (
            currentPhase,
            e.activeCandidateCount,
            votes,
            visible
        );
    }

    function getElectionAdminStats(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        onlyLiveResultViewers
        returns (
            uint8 phase,
            uint256 totalCandidateCount,
            uint256 activeCandidateCount,
            uint256 totalVotes
        )
    {
        Election storage e = elections[_electionId];
        uint8 currentPhase = getElectionPhase(_electionId);

        return (
            currentPhase,
            e.totalCandidateCount,
            e.activeCandidateCount,
            e.totalVotes
        );
    }

    // =========================
    // Candidate Getters
    // =========================

    function getCandidateInfo(uint256 _electionId, uint256 _candidateId)
        external
        view
        electionExists(_electionId)
        returns (
            uint256 id,
            string memory name,
            string memory slogan,
            string memory imageUrl,
            string memory achievements,
            string memory goals,
            bool exists,
            bool isActive
        )
    {
        Candidate storage c = candidates[_electionId][_candidateId];

        return (
            c.id,
            c.name,
            c.slogan,
            c.imageUrl,
            c.achievements,
            c.goals,
            c.exists,
            c.isActive
        );
    }

    function getCandidatePublicVotes(uint256 _electionId, uint256 _candidateId)
        external
        view
        electionExists(_electionId)
        returns (
            uint256 publicVoteCount,
            bool publicResultsVisible
        )
    {
        Candidate storage c = candidates[_electionId][_candidateId];
        Election storage e = elections[_electionId];
        bool visible = _canPublicSeeResults(e);
        uint256 votes = visible ? c.voteCount : 0;

        return (votes, visible);
    }

    function getCandidateAdminVotes(uint256 _electionId, uint256 _candidateId)
        external
        view
        electionExists(_electionId)
        onlyLiveResultViewers
        returns (uint256 voteCount)
    {
        Candidate storage c = candidates[_electionId][_candidateId];
        return c.voteCount;
    }

    function getCandidateIds(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (uint256[] memory)
    {
        return candidateIdsByElection[_electionId];
    }

    function getActiveCandidateIds(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (uint256[] memory)
    {
        Election storage e = elections[_electionId];
        uint256[] storage allIds = candidateIdsByElection[_electionId];
        uint256[] memory activeIds = new uint256[](e.activeCandidateCount);

        uint256 count = 0;

        for (uint256 i = 0; i < allIds.length; i++) {
            uint256 candidateId = allIds[i];
            Candidate storage c = candidates[_electionId][candidateId];

            if (c.exists && c.isActive) {
                activeIds[count] = candidateId;
                count++;
            }
        }

        return activeIds;
    }

    // =========================
    // Wallet / Signature Helpers
    // =========================

    function hasMyWalletVoted(uint256 _electionId)
        external
        view
        electionExists(_electionId)
        returns (bool)
    {
        return hasVotedByWallet[_electionId][msg.sender];
    }

    function getEligibilityDigest(uint256 _electionId, address _voter)
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(address(this), block.chainid, _electionId, _voter)
        );
    }

    function getEthSignedMessageHash(bytes32 _messageHash)
        public
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
        );
    }

    function isEligibilitySignatureValid(
        uint256 _electionId,
        address _voter,
        bytes calldata _signature
    ) external view returns (bool) {
        return _isValidEligibilitySignature(_electionId, _voter, _signature);
    }

    // =========================
    // Internal Helpers
    // =========================

    function _isElectionAcceptingVotes(Election storage e)
        internal
        view
        returns (bool)
    {
        return (
            e.isOpen &&
            !e.isFinalized &&
            block.timestamp >= e.startTime &&
            block.timestamp <= e.endTime
        );
    }

    function _canPublicSeeResults(Election storage e)
        internal
        view
        returns (bool)
    {
        return e.isFinalized || block.timestamp > e.endTime;
    }

    function _isValidEligibilitySignature(
        uint256 _electionId,
        address _voter,
        bytes memory _signature
    ) internal view returns (bool) {
        if (eligibilitySigner == address(0)) {
            return false;
        }

        bytes32 digest = getEligibilityDigest(_electionId, _voter);
        bytes32 ethSigned = getEthSignedMessageHash(digest);

        return _recoverSigner(ethSigned, _signature) == eligibilitySigner;
    }

    function _recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature version");

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }
}
