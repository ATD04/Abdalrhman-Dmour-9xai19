# 🧠 Reflection Check-In — 9XAI Fellowship

> ⏱️ **Estimated time to complete: 10–15 minutes**  
> Fill this out **twice per week** — on **Tuesday** (mid-week) and **Thursday** (end of week).  
> Be honest — the more specific you are, the better we can support you.

---

## 📋 The Basics

**Your Name**: Abdalrhman Dmour
**Date**: 5/5/2026 + 7/5/2026
**This is my**: ✅ Tuesday check-in ✅ Thursday check-in

---

## 🎯 What I Actually Did Since Last Check-In

> Don't overthink this — just list the concrete things you worked on. Be specific.  
> ❌ Bad: "Worked on the project"  
> ✅ Good: "Built the JWT auth system with bcrypt + 24h token expiry"

### Tasks I completed or made progress on

1. Rebuilt the entire traffic monitoring system from scratch — restructured the backend with FastAPI + SQLite + YOLO v2.6s + ByteTrack as a single runnable Python process
2. Rewrote the dashboard frontend from 1466 lines to 817 lines — cleaner layout with 8 labeled sections, readable fonts (min 12px), Chart.js 4.4.0 for 4 live charts
3. Integrated Google Maps Distance Matrix API to pull real-time congestion data (travel time normal vs traffic) for the Wadi Saqra — Arar St corridor, polling every 15 minutes
4. Added an AI chatbot powered by Anthropic Claude with session memory, quick-reply chips, typing spinner, and tool-use badges — embedded as a floating panel in the dashboard
5. Created TEAM_ROLES.md dividing 20 team members into 7 specialized teams (Detection, Backend, Frontend, Data, Infrastructure, QA, PM) with clear file ownership per team

### Pick ONE of the tasks above and tell me more

> **Task: Rebuilt the entire traffic monitoring system from scratch**

**What tools/technologies did you use?** (be specific — framework names, libraries, APIs)  
- **Detection**: YOLO v2.6s (object detection) + ByteTrack (multi-object tracking) to count vehicles crossing 4 directional lines in a video loop  
- **Backend**: FastAPI (Python) serving 15+ endpoints — live counts, forecasts, signal state, advisor, cost, heatmap, incidents, chatbot  
- **Database**: SQLite with 3 tables — vehicle counts, congestion conditions, incidents  
- **External APIs**: Google Maps Distance Matrix API (congestion ratio) + Anthropic Claude claude-sonnet-4-5 (chatbot)  
- **Frontend**: Vanilla HTML/CSS/JS + Chart.js 4.4.0 — no build tools, single static file served by FastAPI  
- **Video**: OpenCV to stream processed frames as MJPEG to the browser via `/video_feed`

**Why did you build it THIS way?** (was there another option you considered?)  
The entire system — detection, API, and dashboard — runs as a single Python process launched with one command. I considered splitting it into microservices (separate detection service, separate API server) but that would require Docker orchestration and add complexity the team couldn't maintain easily. Keeping it as one process means anyone on the team can run it with `python3 step3_line_count.py` and everything starts: YOLO detection loop, FastAPI server, Google Maps poller, and signal timing simulator — all at once. The tradeoff is it's harder to scale, but for a hackathon demo that's the right call.

### Which project(s) did you contribute to?

**Primary project**: Wadi Saqra AI Traffic Monitoring System  
**Did you contribute to any other project?**  
- [x] No — focused on my main project only  
- [ ] Yes → Which one(s)? _______________

---

## 🔥 The Hardest Problem I Faced

> Think of a moment since your last check-in where something wasn't working and you had to figure it out.  
> If nothing broke — what was the most challenging thing you built?

**What was the problem?**  
I decided to restart the entire project from scratch because I had too many gaps in understanding the requirements — what the system was supposed to do, how the components connected, and how to use AI in the pipeline. The original codebase was confusing and I couldn't move forward confidently.

**How did you discover it?**
- [ ] I found it myself while working
- [ ] A teammate told me about it
- [ ] It came up in testing
- [x] The program manager / mentor pointed it out
- [ ] A user / demo found it
- [ ] Other: _______________

**Walk me through what you did to fix it** (step by step — like you're explaining to a friend)  
1. Stopped trying to patch the old code and made the decision to start fresh — the existing implementation was too tangled to fix incrementally.  
2. Asked Bisharah to sit down with me and walk through the project requirements together — what data we needed to collect, what the dashboard had to show, and where AI fit in.  
3. Used AI (GitHub Copilot) as a pair-programming partner to help design the system architecture — YOLO for detection, FastAPI for the backend, SQLite for storage, and a single-process approach for simplicity.  
4. Once the architecture was clear, rebuilt each piece one at a time: detection pipeline first, then API endpoints, then dashboard — testing each layer before connecting the next.

**How long did it take?**  
- [ ] Under 1 hour
- [ ] 1-3 hours  
- [ ] Half a day
- [x] More than a day
- [ ] Still working on it

**Did the fix prevent it from happening again, or was it a quick patch?**  
- [x] Permanent fix — it won't happen again
- [ ] Temporary — might need revisiting
- [ ] Not sure

---

## 📈 Skill Check

> Be real with yourself. Rate your **current comfort level** (not where you want to be).

| Skill | Comfort Level (1-5) | Did it improve since last check-in? |
|---|:---:|:---:|
| Python / Backend (FastAPI, etc.) | ⬜1 ⬜2 ⬜3 ✅4 ⬜5 | ✅ Yes ⬜ No ⬜ N/A |
| Frontend (React, TypeScript, etc.) | ⬜1 ⬜2 ✅3 ⬜4 ⬜5 | ✅ Yes ⬜ No ⬜ N/A |
| AI/ML (RAG, Embeddings, Agents) | ⬜1 ⬜2 ✅3 ⬜4 ⬜5 | ✅ Yes ⬜ No ⬜ N/A |
| DevOps (Docker, Deployment, CI/CD) | ⬜1 2 ⬜3 ✅4 ⬜5 | ✅ Yes  No ⬜ N/A |
| Communication & Presenting | ⬜1 ⬜2 ✅3 ⬜4 ⬜5 | ⬜ Yes ⬜ No ✅ N/A |
| Problem Solving & Debugging | ⬜1 ⬜2 ⬜3 ⬜4 ✅5 | ✅ Yes ⬜ No ⬜ N/A |
| Teamwork & Collaboration | ⬜1 ⬜2 ✅3 ⬜4 ⬜5 | ⬜ Yes ⬜ No ✅ N/A |

> **1** = "I'd panic if asked to do this alone"  
> **3** = "I can handle it with some Googling"  
> **5** = "I could teach someone else how to do this"

---

## 🤝 Who I Worked With

> No one builds alone. Tell us about your team interactions.

**Name a teammate you worked closely with. What did you do together?**  
No one this time helped me
**Did you help someone who was stuck? What was the situation?**  
No
**Did someone help YOU when you were stuck? What happened?**  
In github izz helped me in simple thing

**Did you contribute to a group outside your primary project?**  
- [x] No — focused on my main project
- [ ] Yes → Which group? _______________  
  What exactly did you do for them? _______________

---

## 💡 The "Aha!" Moment

> What's one thing you learned since your last check-in that clicked — something you didn't understand before but now you do?  
> Try to explain it like you'd explain it to a friend who's not in the program.

I learned that writing more code is not the solution when you don't fully understand the problem. I spent time working on a codebase that kept getting more confusing, thinking if I just kept pushing I'd eventually figure it out. The real breakthrough came when I stopped completely, sat with Bisharah, and asked: "what exactly does this system need to do?" — before touching any code.

It's like trying to build a house without a blueprint. You can lay bricks all day but if you don't know where the walls go, you'll just end up tearing them down. Once I had a clear picture of the requirements — what data to collect, how components connect, where AI fits in — rebuilding took much less time and confusion than all the patching I was doing before.

The lesson: when you feel stuck and confused, the answer is usually not to code harder. It's to step back, talk to someone, and get clear on what you're actually trying to build first.

---

## 🚧 What's Blocking Me

> Be honest. If nothing is blocking you, write "Nothing — I'm clear."

**Is anything slowing you down right now?**  
The Google Maps Distance Matrix API only polls every 15 minutes, so real-time congestion data has a lag. Also, the YOLO model runs on CPU which limits detection speed.

**What have you already tried to unblock yourself?**  
For the API lag: implemented a local congestion cache so the dashboard still shows the last known value while waiting for the next poll. For CPU speed: using a smaller model (yolo26s) which balances speed vs accuracy.

**What would help you move faster?**  
- [x] More time
- [ ] Pair-programming with a specific teammate
- [ ] A mentor/coach session on a specific topic
- [ ] Better documentation / clearer requirements
- [x] Access to tools/accounts/APIs
- [ ] Nothing — I'm good
- [ ] Other: _______________

---

## ⚡ Quick Fire Round

> Don't think. Just write the first thing that comes to mind.

**Since last check-in I'm most proud of**: Rewriting the entire dashboard from scratch and making it cleaner, faster, and more readable without breaking any existing functionality

**The decision I made that had the biggest impact**: To rebuild the project is was the biggest impact on me , but it is a good impact because I have understood what the project is and how to build it , so it gave me more skills to deal with any new project and to understand it 

**One thing I wish I handled differently**: Should have set up absolute paths from day one instead of discovering the bug later when testing from different directories

**My energy level right now** (pick one):  
🔴 Low — struggling to stay focused  
🟡 Medium — having good and bad moments  
🟢 High — feeling productive and engaged ✅

---

# 📌 THURSDAY ONLY — Weekly Goal Review

> ⚠️ **Fill this section ONLY on Thursday.** Skip it on Tuesday.  
> Pull out your **Sunday Weekly Plan** and let's see how the week went.

### How Did I Do Against My Sunday Plan?

> Copy your goals from Sunday's plan and mark the result.

| # | Goal I Set on Sunday | Status | Notes |
|---|---|:---:|---|
| 1 |Finish the Traffic System| ✅ Done ⬜ Partial ⬜ Not Started | | 
| 2 | Start a new usecase | ✅ Done ⬜ Partial ⬜ Not Started | _______________ |


**If something didn't get done — what happened?**  
Nothing , Everyhting is done ✅

**Was my Sunday plan realistic?**  
- [x] Yes — I estimated well
- [ ] Too ambitious — I set too many goals
- [ ] Too easy — I finished early and could have done more
- [ ] Mixed — some goals were right, others were off

### Week Summary

**Hours I put in this week (approx.)**: 27 hours

**My biggest strength this week**: Finishing my work early and reviewing other teammates' work , also finish all my required work alone 

**The skill I most need to level up**: To know more technologies and improve my Technical skills 

**If I had to give myself a grade this week (A-F)**:A  
**Why?**: Because I finished my work early and helped others

**What I want to focus on next week** (this feeds into Sunday's plan):  
To start a new project , Building the system very well and to know more technologies to get  best skills

---

> 📌 **Cadence Reminder:**  
> 🟦 **Sunday** → Fill out the Weekly Plan (set goals)  
> 🟧 **Tuesday** → Fill out this check-in (skip the Thursday section)  
> 🟥 **Thursday** → Fill out this check-in + the Weekly Goal Review section  
>  
> 💬 *"The person who writes the most specific reflection gets the most accurate progress report."*
