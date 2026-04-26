# Project Explanation — Simple and Structured English Version

## 1. Solution Development and Iteration

The team started with a clear and simple idea:

A Jordanian citizen asks a question in Arabic, the system gives an accurate answer with clear sources, and if the system cannot answer confidently, the question is transferred to a human operator.

At the beginning, the solution was built using **FastAPI** and **Gemini**, with a simple local database. From the start, the team planned the platform as several separate services so that different team members could work in parallel.

During development, some early solutions did not work well enough for a real government platform. Because of that, the team improved the system step by step.

---

## 2. Solutions That Were Tried and Rejected

### Solution A: SQLite with NumPy/JSON Files

At first, the team used a local SQLite database and files to store embeddings.

This worked for small testing, but it was not suitable for a large government platform.

**Why it failed:**

It could not handle a large number of documents. It also did not support strong similarity search, and every query required loading large embedding files into memory. In addition, it was not suitable for separating data by ministry.

---

### Solution B: A Large Monolithic Orchestrator

The first architecture used a large and complex Python class structure.

**Why it failed:**

As the team added more features, the code became harder to manage. The codebase reached around 9,000 lines, and many parts were tightly connected. Any small change required editing multiple classes, which made bugs difficult to find and fix.

---

### Solution C: Keyword-Based Escalation

The first escalation system used simple keyword matching to decide if a question should be sent to a human operator.

**Why it failed:**

This method was not accurate, especially in Arabic. Sometimes it escalated questions that the system could answer, and sometimes it missed questions that really needed human support. It also struggled with Arabic paraphrasing and different ways of writing the same meaning.

---

### Solution D: ivfflat Vector Index

The team also tested the ivfflat index for vector search.

**Why it failed:**

It needed regular maintenance and manual tuning as the number of document chunks increased. This created extra operational work, which is not ideal for a government platform that should be stable and easy to maintain.

---

## 3. Main Improvements and Technical Pivot

After testing these early solutions, the team decided to replace the weak parts instead of continuously patching them.

### 3.1 Moving to Supabase and pgvector

The vector storage was moved from local files and SQLite to **Supabase with pgvector**.

This made the system more reliable because it supported cloud storage, concurrent access, and native vector search. It also helped separate data by ministry.

---

### 3.2 Replacing the Orchestrator with LangGraph

The old complex orchestrator was replaced with a clearer system built using **LangGraph**.

Instead of having everything inside large classes, the pipeline became a set of separate stages:

- Retrieve information
- Review the answer
- Calculate confidence
- Escalate when needed
- Format the final response

This made the system easier to test, understand, and maintain. It also removed about **7,912 lines of unnecessary code**.

---

### 3.3 Improving the Escalation System

The escalation logic was rebuilt using multiple layers:

1. Detecting phrases that show the system does not have enough information.
2. Using an LLM-based semantic review.
3. Checking the confidence score.

This made escalation more accurate and safer than relying only on keywords.

---

### 3.4 Replacing ivfflat with HNSW

The team replaced ivfflat with **HNSW** because it is faster, more stable, and does not require the same level of maintenance.

---

## 4. Final Implemented Solution

The final solution is a five-service platform connected through **Docker Compose**.

---

## 4.1 Knowledge Service

The **Knowledge Service** is responsible for processing ministry documents.

It handles:

- Reading PDF, DOCX, and PPTX files
- Extracting text and images
- Splitting documents into smaller chunks
- Generating embeddings using Gemini
- Storing the data in Supabase pgvector
- Separating data by ministry

---

## 4.2 Agent Service

The **Agent Service** is responsible for answering user questions.

It handles:

- Searching for the most relevant information
- Generating answers using Gemini
- Reviewing the answer
- Calculating confidence
- Sending answers with citations
- Escalating the question if confidence is low

---

## 4.3 Governance Service

The **Governance Service** checks and audits system responses.

It helps with:

- Applying guardrails
- Monitoring answer quality
- Providing evaluation metrics for executive dashboards

---

## 4.4 Workflow Service

The **Workflow Service** manages questions that need human support.

It handles:

- Creating escalation tickets
- Tracking ticket status
- Assigning tickets to the right operator
- Closing tickets after resolution

This service is still not fully complete.

---

## 4.5 Frontend

The frontend is built using **Next.js and React**.

It includes:

- Citizen chat interface
- Operator escalation desk
- Admin knowledge-management panel
- Executive analytics dashboard
- Arabic RTL support
- Dark and light themes
- Streaming indicators while answers are being generated

---

## 5. Team Composition and Workflow

The team included five members working across frontend, backend, infrastructure, and data.

The project was developed during an intensive sprint from **March 11 to April 21, 2026**.

| Team Member | Main Role | Key Contributions |
|---|---|---|
| Mahmoud Sadder | Technical Lead / Knowledge Service Owner | Knowledge-service architecture, smart document classification, DOCX-to-PDF pipeline, governance service, Docker infrastructure, escalation logic, and final production fixes |
| Ezzaldeen Hamdan | Agent Service Lead / Architect | Supabase integration, SSE streaming, LangGraph migration, A2A protocol, ministry partitioning, authentication overhaul, and V2 orchestrator |
| Shahed Al Zu'bi | Infrastructure and Performance Lead | Redis caching, session management, HNSW migration, and metadata enrichment |
| Abdalrhman Dmour | Frontend Lead | UI/UX overhaul, admin dashboards, executive dashboards, expert dashboards, Arabic localization, topic insights, source deletion UI, and component architecture |
| Salsabeel Riyad | Contributor | Supporting development across services |

---

## 6. Collaboration Method

The team used **GitHub Flow** with feature branches and Pull Requests.

A total of **41 Pull Requests** were merged during the project.

Because development was fast, merge conflicts happened often. The team resolved them directly before merging. They also used a shared VS Code workspace to keep the development environment consistent.

The team also used AI pair-programming tools such as **Cursor** and **Claude**, along with manual development.

---

## 7. Skills Acquired During the Project

### 7.1 Technical Skills

The project helped the team build and apply important technical skills, such as:

- RAG pipeline design
- LangGraph and LangChain
- pgvector and HNSW indexing
- Server-Sent Events streaming
- Google Gemini API
- Redis caching
- FastAPI async development
- Supabase and PostgreSQL
- Docker multi-service composition
- Next.js App Router
- Arabic NLP and RTL design
- PyMuPDF and LibreOffice document processing

---

### 7.2 Soft Skills

The team also developed important professional skills, including:

- Breaking large problems into smaller parts
- Knowing when to replace a weak solution instead of patching it
- Working under deadline pressure
- Coordinating between frontend, backend, infrastructure, and data work
- Writing documentation while still developing
- Resolving Git conflicts
- Communicating across different technical roles

---

## 8. Direct Impact of the Skills

Some skills had a direct impact on the success of the project.

**LangGraph** helped the team remove a large amount of complex code and made the system easier to extend.

**SSE streaming** improved the user experience because citizens could see the answer being generated gradually instead of waiting silently for 10 to 30 seconds.

**Redis caching** reduced Gemini API calls by around **60% to 70%**, which made the platform more cost-efficient.

**HNSW indexing** made document retrieval faster and more stable, which was important for confidence scoring and real-time answers.

---

## 9. Current Project Status — April 26, 2026

| Service | Completion | Status |
|---|---:|---|
| Knowledge Service | Around 100% | Ready |
| Agent Service | Around 100% | Ready |
| Governance Service | Around 100% | Ready |
| Workflow Service | Around 40% | Partially complete |
| Frontend | Around 60–70% | Functional, but needs polishing |
| Overall Platform | Around 85% | Core intelligence is ready, but the operational layer is not fully complete |

---

## 10. What Has Been Completed

The team has completed many strong parts of the platform, including:

- Collecting and organizing documents from Jordanian ministries
- Building a complete RAG pipeline
- Supporting answers with citations
- Supporting real-time streaming
- Calculating confidence scores
- Escalating questions when the system is not confident
- Applying governance guardrails
- Building a Supabase database with ministry-based partitioning
- Using HNSW for fast vector search
- Using Redis to reduce cost and improve performance
- Supporting role-based access for citizens, operators, and admins
- Building an Arabic-friendly frontend with RTL support
- Merging 41 Pull Requests
- Fixing critical escalation and scoring bugs

---

## 11. What Still Needs Work

Although the core AI system is strong, some parts still need to be completed.

The remaining work includes:

- Ingesting the full document corpus into the vector database
- Completing the Workflow Service, especially SLA handling, email notifications, and supervisor assignment
- Hardening production authentication
- Improving frontend component structure
- Fixing Docker health checks and CI/CD paths
- Creating a Kubernetes migration plan for production-scale deployment

---

## 12. Final Summary

The project developed from a simple idea into a smart government platform that can read ministry documents, understand citizen questions, generate cited answers, calculate confidence, and escalate questions to human operators when needed.

The strongest part of the project is that the team did not stay attached to weak early solutions. Instead, they tested, learned, and replaced the parts that were not suitable for production.

At the current stage, the core AI intelligence is almost ready, especially the Knowledge Service, Agent Service, and Governance Service.

However, the platform still needs more work on operational features such as workflow management, notifications, production authentication, and frontend polishing before it can be considered fully production-ready.
