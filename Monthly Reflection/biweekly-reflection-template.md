# 🧠 Biweekly Reflection — 9XAI Fellowship

> ⏱️ **Estimated time to complete: 10–15 minutes**  
> Fill it out honestly — there are no wrong answers. The more specific you are, the better we can support you.

---

## 📋 The Basics

**Your Name**: Abdalrhman Dmour  
**Date**: From 1/3/2026 to 8/4/2026  
**Week #**: 4 weeks

---

## 🎯 What I Actually Did These Two Week

> Don't overthink this — just list the concrete things you worked on. Be specific.  
> ❌ Bad: "Worked on the project"  
> ✅ Good: "Built the JWT auth system with bcrypt + 24h token expiry"

### Main Tasks (list 3-7 things you actually completed or made progress on)

1. Built the complete Frontend for Shahem Project using Next.js (TypeScript/TSX) with Tailwind CSS, focusing on user-friendly interface design
2. Developed database architecture for Shahem using Supabase (PostgreSQL) + local SQLite files with ministry-specific tables for data ingestion
3. Contributed to the Court Project (Speech-to-Text AI Platform) — conducted budget analysis and helped select Speechmatics as the optimal STT model
4. Built a Netflix-style Recommendation System in a 2-hour hackathon — enhanced frontend, backend, and LLM integration with the team
5. Built an Ex-Google Maps PM Vibe Coded Palantir individually using VS Code with Claude LLM in 3 hours
6. Integrated Claude with Paperclip tool to build a zero-human-resource company with 5 AI agents for schedule management, later optimized with OpenCode API + GitHub Copilot + GPT 5.4 Codex for cost efficiency

### Pick ONE of the tasks above and tell me more about it

> Why this one? Because it helps us understand how you think, not just what you shipped.

**What tools/technologies did you use?** (be specific — framework names, libraries, APIs)  
Next.js (App Router) written in TypeScript/TSX for the frontend framework, Tailwind CSS for responsive styling, Supabase (PostgreSQL) as the primary database backend, local SQLite files for ministry-specific data storage, and GitHub for version control and collaboration.

**Why did you build it THIS way?** (was there another option you considered?)  
I chose Next.js with TypeScript because it provides type safety and better developer experience, especially for a complex project with multiple contributors. Tailwind CSS was selected for rapid UI development and consistent styling. For the database, we used Supabase (PostgreSQL) for the backend services while keeping local SQLite files for ministry-specific data — this hybrid approach allowed each ministry to maintain its own isolated data table while keeping the main system centralized. An alternative was using a single database for everything, but the ministry-specific SQLite approach gave us better data isolation and easier data ingestion per department.

### Which project(s) did you contribute to in this period?

**Primary project**: Shahem Project  
**Did you contribute to any other project in this period?**  
- [ ] No — focused on my main project only  
- [x] Yes → Which one(s)? Court Project (Speech-to-Text), Netflix Recommendation System Hackathon, Claude + Paperclip Integration

---

## 🔥 The Hardest Problem I Faced (Past 2 Weeks)

> Think of a moment in the past two weeks where something wasn't working and you had to figure it out.  
> If nothing broke — what was the most challenging thing you built?

**What was the problem?**  
In the Claude + Paperclip integration project, Claude API costs were too expensive to run a company with 5 AI agents continuously. The system was functional but not economically viable for long-term deployment.

**How did you discover it?**
- [x] I found it myself while working
- [ ] A teammate told me about it
- [ ] It came up in testing
- [ ] The program manager / mentor pointed it out
- [ ] A user / demo found it
- [ ] Other: _______________

**Walk me through what you did to fix it** (step by step — like you're explaining to a friend)  
1. First, I analyzed the API usage and identified that Claude's pricing model was the bottleneck for our use case  
2. I researched alternative LLM providers that could deliver similar performance at lower cost  
3. I discovered that using OpenCode API through GitHub with Copilot integration, combined with GPT 5.4 Codex, could achieve the same functionality  
4. I refactored the integration to use these alternative APIs while maintaining the same agent architecture  
5. Tested the new setup thoroughly to ensure all 5 agents still performed their scheduling tasks correctly

**How long did it take?**  
- [ ] Under 1 hour
- [ ] 1-3 hours  
- [x] Half a day
- [ ] More than a day
- [ ] Still working on it

**Did the fix prevent it from happening again, or was it a quick patch?**  
- [x] Permanent fix — it won't happen again
- [ ] Temporary — might need revisiting
- [ ] Not sure

---

## 📈 Skill Check

> Be real with yourself. Rate your **current comfort level** (not where you want to be).

| Skill | Comfort Level (1-5) | Did it improve this week? |
|---|:---:|:---:|
| Python / Backend (FastAPI, etc.) | ⬜1 ⬜2 ☑️3 ⬜4 ⬜5 | ☑️ Yes ⬜ No ⬜ N/A |
| Frontend (React, TypeScript, etc.) | ⬜1 ⬜2 ⬜3 ☑️4 ⬜5 | ☑️ Yes ⬜ No |
| AI/ML (RAG, Embeddings, Agents) | ⬜1 ⬜2 ☑️3 ⬜4 ⬜5 | ☑️ Yes ⬜ No |
| DevOps (Docker, Deployment, CI/CD) | ⬜1  ⬜2 ⬜3 ☑️4 ⬜5 | ☑️ Yes ⬜ No |
| Communication & Presenting | ⬜1 ⬜2 ⬜3 ☑️4 ⬜5 | ☑️ Yes ⬜ No |
| Problem Solving & Debugging | ⬜1 ⬜2 ⬜3 ☑️4 ⬜5 | ☑️ Yes ⬜ No |
| Teamwork & Collaboration | ⬜1 ⬜2 ⬜3 ⬜4 ☑️5 | ☑️ Yes ⬜ No |

> **1** = "I'd panic if asked to do this alone"  
> **3** = "I can handle it with some Googling"  
> **5** = "I could teach someone else how to do this"

---

## 🤝 Who I Worked With (Past 2 Weeks)

> No one builds alone. Tell us about your team interactions over the past two weeks.

**Name a teammate you worked closely with in this period. What did you do together?**  
Name: Court Project Team (2 teammates)  
What you did: Collaborated on the Speech-to-Text AI platform — I handled the budget analysis and cost estimation for court implementation while they focused on model selection. Together, we evaluated multiple STT models and decided Speechmatics was the best fit for courtroom accuracy requirements.

**Did you help someone who was stuck? What was the situation?**  
During the Netflix Hackathon, I helped my team by researching and finding open-source recommendation system code that we could build upon. This gave us a strong starting point and saved crucial time during the 2-hour hackathon window.

**Did someone help YOU when you were stuck? What happened?**  
My Shahem team members gave me valuable advice on feature implementation and system functionality. Their feedback helped me improve the user interface design and ensure the frontend was properly integrated with the backend services.

**Did you contribute to a group outside your primary project in this period?**  
- [ ] No — focused on my main project
- [x] Yes → Which group? Court Project Team, Netflix Hackathon Team, Paperclip Integration Partner  
  What exactly did you do for them? For Court Project: conducted budget analysis for court implementation costs. For Netflix Hackathon: found open-source code resources and enhanced the LLM integration. For Paperclip: found cost-effective API alternatives (OpenCode + GitHub Copilot).

---

## 💡 The "Aha!" Moment (Past 2 Weeks)

> What's one thing you learned in the past two weeks that clicked — something you didn't understand before but now you do?  
> Try to explain it like you'd explain it to a friend who's not in the program.

I finally understood what RAG (Retrieval-Augmented Generation) really means and how it works. Think of it like this: instead of an AI trying to remember everything (which is expensive and often wrong), RAG lets the AI "look up" information from a database when you ask a question. It's like the difference between memorizing an entire textbook versus knowing how to quickly find the right page. The data gets broken into "chunks," converted into "embeddings" (numerical representations), and stored so the AI can retrieve relevant pieces when needed. This clicked when I was working on the Shahem database architecture — I realized we were essentially building the "knowledge base" that an AI could later query. Also when my teammate told me that no one in the world know how the AI think and how it respond because their is something called Blackbox in the AI which working like the brain of a human , so it was a shock to me also.

---

## 🚧 What's Blocking Me

> Be honest. If nothing is blocking you, write "Nothing — I'm clear."

**Is anything slowing you down right now?**  
Nothing major — I'm adapting well to AI development despite coming from a cybersecurity background. The main challenge is the learning curve with new AI concepts, but I'm managing it through hands-on projects.

**What have you already tried to unblock yourself?**  
I've been learning through doing — jumping into projects, researching solutions when stuck, and asking teammates for advice. I've also been exploring different LLMs (Claude, Gemini, Codex) to understand their strengths.

**What would help you move faster?**  
- [ ] More time
- [ ] Pair-programming with a specific teammate
- [ ] A mentor/coach session on a specific topic
- [ ] Better documentation / clearer requirements
- [x] Access to tools/accounts/APIs
- [ ] Nothing — I'm good
- [ ] Other: _______________

---

## ⚡ Quick Fire Round

> Don't think. Just write the first thing that comes to mind.

**These two weeks I'm most proud of**: Successfully delivering multiple fully functional projects — especially the Shahem frontend and the Netflix Hackathon system that we built to be better than the original  

**The decision I made this week that had the biggest impact**: Implementing a backup mechanism during the Netflix Hackathon (one person building independently while 4 worked together) — this gave us redundancy and two working demos  

**One thing I wish I handled differently**: Started learning GitHub earlier in the month — it would have made collaboration smoother from day one  

**In the next two weeks I want to own**: Deeper understanding of backend development and AI agent orchestration to complement my frontend skills  

**My energy level this period** (pick one):  
🔴 Low — struggled to stay focused  
🟡 Medium — had good and bad days  
🟢 High — felt productive and engaged ✓

---

## 📊 Personal Tracking (Optional — for your own growth)

> These are for your own tracking. We use them to build your assessment, but we won't share specifics publicly.

**Hours I put in this period (approx.)**: 120+ hours

**My biggest strength right now**: Problem-solving and finding efficient solutions quickly — I can identify the fastest path to deliver a working product, whether it's finding useful open-source code or alternative APIs

**The skill I most need to level up**: Python backend development and deeper AI/ML fundamentals (beyond just using APIs)

**If I had to give myself a grade this week (A-F), I'd give myself**: A-  
**Why?**: I delivered on every project assigned, contributed meaningfully to multiple teams, and successfully transitioned from cybersecurity to AI development. The minus is because I know there's still room to deepen my technical understanding in backend and AI fundamentals rather than just making things work.

---

> **That's it!** Submit this to your program manager by the **designated biweekly deadline**.  
> Your reflections directly feed into your Individual Progress Report — the more detail you give, the more accurate your report will be.
>
> 💬 *"The person who writes the most specific reflection gets the most accurate progress report."*
