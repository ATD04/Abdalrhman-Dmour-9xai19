import os

# Configuration for Wadi Saqra Intersection
site_id = "AMM-WS-01"
lat, lon = 31.9613, 35.9038

def generate_sumo_files(base_path):
    os.makedirs(base_path, exist_ok=True)

    # 1. Network File (wadi_saqra.net.xml) - Simplified representation
    net_xml = """<?xml version="1.0" encoding="UTF-8"?>
<net version="1.16" junctionCornerDetail="5" limitTurnSpeed="5.50" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/net_file.xsd">
    <location netOffset="0.00,0.00" convBoundary="-500.00,-500.00,500.00,500.00" origBoundary="35.90,31.96,35.91,31.97" projParameter="!"/>
    
    <!-- Nodes -->
    <junction id="center" type="traffic_light" x="0.00" y="0.00" incLanes="N2C_0 N2C_1 N2C_2 N2C_3 N2C_4 N2C_5 S2C_0 S2C_1 S2C_2 S2C_3 S2C_4 S2C_5 E2C_0 E2C_1 E2C_2 E2C_3 E2C_4 E2C_5 W2C_0 W2C_1 W2C_2 W2C_3 W2C_4 W2C_5" intLanes="" shape="-15,-20 15,-20 15,20 -15,20"/>
    <junction id="north" type="priority" x="0.00" y="500.00" incLanes="C2N_0 C2N_1 C2N_2 C2N_3 C2N_4 C2N_5" intLanes="" shape="0,500"/>
    <junction id="south" type="priority" x="0.00" y="-500.00" incLanes="C2S_0 C2S_1 C2S_2 C2S_3 C2S_4 C2S_5" intLanes="" shape="0,-500"/>
    <junction id="east" type="priority" x="500.00" y="0.00" incLanes="C2E_0 C2E_1 C2E_2 C2E_3 C2E_4 C2E_5" intLanes="" shape="500,0"/>
    <junction id="west" type="priority" x="-500.00" y="0.00" incLanes="C2W_0 C2W_1 C2W_2 C2W_3 C2W_4 C2W_5" intLanes="" shape="-500,0"/>

    <!-- Edges (Lanes: 3 Through, 2 Left, 1 Right) -->
    <edge id="N2C" from="north" to="center" priority="1" numLanes="6" speed="13.89"/>
    <edge id="C2N" from="center" to="north" priority="1" numLanes="6" speed="13.89"/>
    <edge id="S2C" from="south" to="center" priority="1" numLanes="6" speed="13.89"/>
    <edge id="C2S" from="center" to="south" priority="1" numLanes="6" speed="13.89"/>
    <edge id="E2C" from="east" to="center" priority="1" numLanes="6" speed="13.89"/>
    <edge id="C2E" from="center" to="east" priority="1" numLanes="6" speed="13.89"/>
    <edge id="W2C" from="west" to="center" priority="1" numLanes="6" speed="13.89"/>
    <edge id="C2W" from="center" to="west" priority="1" numLanes="6" speed="13.89"/>

    <!-- Traffic Light Logic -->
    <tlLogic id="center" type="static" programID="0" offset="0">
        <phase duration="31" state="GGGGggrrrrrrGGGGggrrrrrr"/> <!-- N/S Through -->
        <phase duration="6"  state="yyyyyyrrrrrryyyyyyrrrrrr"/>
        <phase duration="31" state="rrrrrrGGGGggrrrrrrGGGGgg"/> <!-- E/W Through -->
        <phase duration="6"  state="rrrrrryyyyyyrrrrrryyyyyy"/>
    </tlLogic>
</net>
"""
    with open(os.path.join(base_path, "wadi_saqra.net.xml"), "w") as f:
        f.write(net_xml)

    # 2. Route File (wadi_saqra.rou.xml)
    rou_xml = """<?xml version="1.0" encoding="UTF-8"?>
<routes xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/routes_file.xsd">
    <vType id="car" accel="2.6" decel="4.5" sigma="0.5" length="5" minGap="2.5" maxSpeed="13.89" guiShape="passenger"/>
    <vType id="bus" accel="1.2" decel="4.0" sigma="0.5" length="12" minGap="3" maxSpeed="11.11" guiShape="bus"/>
    <vType id="truck" accel="1.0" decel="3.5" sigma="0.5" length="15" minGap="4" maxSpeed="10.00" guiShape="truck"/>

    <!-- Flows -->
    <flow id="flow_NS" type="car" begin="0" end="3600" vehsPerHour="1200" from="north" to="south"/>
    <flow id="flow_SN" type="car" begin="0" end="3600" vehsPerHour="1000" from="south" to="north"/>
    <flow id="flow_EW" type="car" begin="0" end="3600" vehsPerHour="800" from="east" to="west"/>
    <flow id="flow_WE" type="car" begin="0" end="3600" vehsPerHour="900" from="west" to="east"/>
</routes>
"""
    with open(os.path.join(base_path, "wadi_saqra.rou.xml"), "w") as f:
        f.write(rou_xml)

    # 1. Configuration for Wadi Saqra OSM Network
    # Real Ingress Edges to Junction cluster_645031570_648463551
    osm_edges = [
        ("-50656054#0", "L1"), # شارع طاهر الجزائري
        ("-50656063#3", "L2"), # شارع ابن الفارض (North)
        ("-50839924", "L3"),   # شارع العيون
        ("50656063#1", "L4")    # شارع ابن الفارض (South)
    ]

    # 3. Additional File (Detectors - wadi_saqra.add.xml)
    detectors = []
    for edge, prefix in osm_edges:
        # We assume 1-3 lanes for these residential roads in OSM
        for i in range(1): # Start with 1 lane per edge for safety, can be expanded
            detectors.append(f'    <inductionLoop id="{prefix}-T{i+1}" lane="{edge}_{i}" pos="-20" freq="900" file="detector_output_xml.xml"/>')

    detector_str = "\n".join(detectors)
    add_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<additional xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/additional_file.xsd">
    <!-- Induction Loops for OSM Approaches -->
{detector_str}
</additional>
"""
    with open(os.path.join(base_path, "wadi_saqra.add.xml"), "w") as f:
        f.write(add_xml)

    # 4. SUMO Config (wadi_saqra.sumocfg)
    cfg_xml = """<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/sumoConfiguration.xsd">
    <input>
        <net-file value="wadi_saqra_osm.net.xml"/>
        <route-files value="wadi_saqra_osm.rou.xml"/>
        <additional-files value="wadi_saqra.add.xml"/>
    </input>
    <time>
        <begin value="0"/>
        <end value="28800"/>
    </time>
    <report>
        <no-step-log value="true"/>
        <duration-log.statistics value="true"/>
    </report>
</configuration>
"""
    with open(os.path.join(base_path, "wadi_saqra.sumocfg"), "w") as f:
        f.write(cfg_xml)

if __name__ == "__main__":
    generate_sumo_files("/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/simulation/sumo")
    print("OSM-based SUMO files generated successfully.")
