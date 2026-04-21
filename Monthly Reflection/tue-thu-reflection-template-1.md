# 🧠 Reflection Check-In — 9XAI Fellowship

> ⏱️ **Estimated time to complete: 10–15 minutes**  
> Fill this out **twice per week** — on **Tuesday** (mid-week) and **Thursday** (end of week).  
> Be honest — the more specific you are, the better we can support you.

---

## 📋 The Basics

**Your Name**: Abdalrhman Dmour  
**Date**: 21/4/2026  
**This is my**: ✅ Tuesday check-in ⬜ Thursday check-in

---

## 🎯 What I Actually Did Since Last Check-In

> Don't overthink this — just list the concrete things you worked on. Be specific.  
> ❌ Bad: "Worked on the project"  
> ✅ Good: "Built the JWT auth system with bcrypt + 24h token expiry"

### Tasks I completed or made progress on

1. Reorganized the entire project folder structure so data files are the main thing, not the dashboard

2. Generated a full 24-hour traffic dataset broken into 15-minute intervals — this is what future AI forecasting models will actually train on

3. Created "contract" files (schemas) that define exactly what format every module must use to send and receive data

4. Built out a complete metadata package — basically a reference map that tells every other module what the cameras are, what the lanes are, what the signal phases are, and how they all connect

5. Fixed the backend so all API endpoints actually return real data, and added a health check that verifies the whole sandbox in one request


### Pick ONE of the tasks above and tell me more

Task 1: Reorganizing the project structure

Before today, the project looked like a demo app. The dashboard was the main thing you'd see. But a dashboard can't feed an AI model — data can.

So I restructured everything. Now the project has clean folders: one for video files, one for detector data, one for signal logs, one for annotations, one for documentation. Every file is in a place that makes sense and has a clear purpose.

The dashboard is still there — it works — but it's now labeled as a "viewer tool," not the main deliverable. The data is the main deliverable.

**What tools/technologies did you use?** (be specific — framework names, libraries, APIs)  
FastAPI — Python backend that serves all the data files as API endpoints
React + Vite — the frontend dashboard (sandbox monitor/viewer)
Recharts — for the traffic volume chart in the dashboard
Python 3 (standard library only — no extra packages needed) — for generating the 24-hour dataset
JSON Schema — for defining the data contracts between modules
YOLOv8 — AI model used for detecting and tracking vehicles in the video
curl — for testing that all API endpoints return real data

**Why did you build it THIS way?** (was there another option you considered?)  
The hackathon requires Phase 1 to be a data sandbox — not a product. So I had to resist the temptation to just keep building on the dashboard and make it look cool.

I could have kept everything as-is and just added more features to the UI. But then Phase 2 would have nothing clean to build on. The schemas and structured data files are what actually let the next phase start without confusion.

Simple reason: data files are reusable, dashboards are not.

### Which project(s) did you contribute to?

**Primary project**: HackathonTraffic
**Did you contribute to any other project?**  
- ✅ No — focused on my main project only  
- [ ] Yes → Which one(s)? _______________

---

## 🔥 The Hardest Problem I Faced

> Think of a moment since your last check-in where something wasn't working and you had to figure it out.  
> If nothing broke — what was the most challenging thing you built?

**What was the problem?**  
After I reorganized all the folders, the dashboard went completely blank. White screen. Nothing loaded.
The confusing part was there were no error messages. The backend was running fine and returning 200 OK — but with empty data. So the frontend showed nothing and I had no idea why at first. Also I faced alot of problems on understanding what the concept of a Sandbox is.

**How did you discover it?**
- ✅ I found it myself while working
- [ ] A teammate told me about it
- [ ] It came up in testing
- [ ] The program manager / mentor pointed it out
- [ ] A user / demo found it
- [ ] Other: _______________

**Walk me through what you did to fix it** (step by step — like you're explaining to a friend)  
I noticed every single API endpoint was returning empty — not an error, just empty. That was the clue.

I went into the backend code and checked every file path. The backend was still looking for files in the old folder locations that no longer existed.

Found the broken paths — for example the incidents file moved from annotations/incidents.csv to annotations/event_validation/incidents.csv, but the backend code still had the old path.

Fixed all the paths, rewrote the backend cleanly, and added a health check endpoint that checks all 10 important files at once — so this can never silently fail again.

Ran a test and confirmed: 96 rows of traffic data, 5 incidents, 7 video clips, and 2,160 signal events all loading correctly.

Also alot of time was spent on understanding what the concept of a Sandbox is.


**How long did it take?**  
- [ ] Under 1 hour
- [ ] 1-3 hours  
- [ ] Half a day
- ✅ More than a day
- [ ] Still working on it

**Did the fix prevent it from happening again, or was it a quick patch?**  
- [ ] Permanent fix — it won't happen again
- [ ] Temporary — might need revisiting
- ✅ Not sure

---

## 📈 Skill Check

> Be real with yourself. Rate your **current comfort level** (not where you want to be).

| Skill | Comfort Level (1-5) | Did it improve since last check-in? |
|---|:---:|:---:|
| Python / Backend (FastAPI, etc.) | ⬜1 ⬜2 ⬜3 ⬜4 ✅ 5 | ✅ Yes ⬜ No ⬜ N/A |
| Frontend (React, TypeScript, etc.) | ⬜1 ⬜2 ⬜3 ⬜4 ✅ 5 | ✅ Yes ⬜ No ⬜ N/A |
| AI/ML (RAG, Embeddings, Agents) | ⬜1 ⬜2 ✅ 3 ⬜4 ⬜5 | ⬜ Yes ✅ No ⬜ N/A |
| DevOps (Docker, Deployment, CI/CD) | ⬜1 ⬜2 ⬜3 ✅ 4 ⬜5 | ✅ Yes ⬜ No ⬜ N/A |
| Communication & Presenting | ⬜1 ⬜2 ⬜3 ⬜4 ✅ 5 | ✅ Yes ⬜ No ⬜ N/A |
| Problem Solving & Debugging | ⬜1 ⬜2 ⬜3 ⬜4 ✅ 5 | ✅ Yes ⬜ No ⬜ N/A |
| Teamwork & Collaboration | ⬜1 ⬜2 ⬜3 ⬜4 ✅ 5 | ✅ Yes ⬜ No ⬜ N/A |

> **1** = "I'd panic if asked to do this alone"  
> **3** = "I can handle it with some Googling"  
> **5** = "I could teach someone else how to do this"

---

## 🤝 Who I Worked With

> No one builds alone. Tell us about your team interactions.

**Name a teammate you worked closely with. What did you do together?**  
Name: Ezz + Issa the new guy  
What you did: We had a meeting to discuss the project and what we need to do. We also had a meeting with the mentor to discuss the project and what we need to do.

**Did you help someone who was stuck? What was the situation?**  
yes , khaled , I hav helped him in the project in the annotation part , he faced some of problems , so I have sent for him the same way that I have built my system , and he fixed his problem.

**Did someone help YOU when you were stuck? What happened?**  
yes , Ezz and ahmad qalaweh , they helped me in the project in the backend part , I faced some of problems , so they have helped me to fix my problem.

**Did you contribute to a group outside your primary project?**  
- ✅ No — focused on my main project
- [ ] Yes → Which group? _______________  
  What exactly did you do for them? _______________

---

## 💡 The "Aha!" Moment

I understood today what schema contracts actually are — not just documentation, but agreements between modules.

Think of it like ordering food. The kitchen (Phase 2 AI module) and the waiter (Phase 3 storage layer) need to agree on what a "plate" looks like before anything works. If the kitchen puts food on a random-shaped plate, the waiter can't carry it.

The schema files I created today are that agreement. I wrote them before Phase 2 is built — so whoever builds the detection module knows exactly what format their output needs to be in. No guessing, no mismatch later.



## 🚧 What's Blocking Me

The dates in my signal timing log (April 1) don't match the dates in my traffic data (April 21). Right now it doesn't break anything because the frontend only looks at the time part (HH:MM), not the full date. But when Phase 2 tries to join these datasets properly, it will cause a problem. Also finding the data to build the project

**Is anything slowing you down right now?**  
Yes I think , It's the data also problem 
**What have you already tried to unblock yourself?**  
so we decided that we will use real data from google maps API , and build simulation videos from it , and we will use it in our project.and there is another way I might use it 

**What would help you move faster?**  
- [ ] More time
- [ ] Pair-programming with a specific teammate
- [ ] A mentor/coach session on a specific topic
- [ ] Better documentation / clearer requirements
- ✅ Access to tools/accounts/APIs
- [ ] Nothing — I'm good
- [ ] Other: _______________

---

## ⚡ Quick Fire Round

The decision I made that had the biggest impact: Treating the data files and schemas as the real deliverable — not the dashboard

One thing I wish I handled differently: I should have updated the backend file paths right away every time I moved a file, not wait until everything was broken at the end

**Since last check-in I'm most proud of**: Improving the skills of the team in the backend part , and also improving my skills in the frontend part , and also improving my skills in the AI part , and also improving my skills in the DevOps part , and also improving my skills in the communication part , and also improving my skills in the problem solving part , and also improving my skills in the teamwork part.  

**The decision I made that had the biggest impact**: reengineering the Phase 1 from begining , and making it more organized and structured.

**One thing I wish I handled differently**: I should have updated the backend file paths right away every time I moved a file, not wait until everything was broken at the end

**My energy level right now** (pick one):  
🟢 High — feeling productive and engaged  

---

# 📌 THURSDAY ONLY — Weekly Goal Review

> ⚠️ **Fill this section ONLY on Thursday.** Skip it on Tuesday.  
> Pull out your **Sunday Weekly Plan** and let's see how the week went.

### How Did I Do Against My Sunday Plan?

> Copy your goals from Sunday's plan and mark the result.

| # | Goal I Set on Sunday | Status | Notes |
|---|---|:---:|---|
| 1 | _________________________________ | ⬜ Done ⬜ Partial ⬜ Not Started | _______________ |
| 2 | _________________________________ | ⬜ Done ⬜ Partial ⬜ Not Started | _______________ |
| 3 | _________________________________ | ⬜ Done ⬜ Partial ⬜ Not Started | _______________ |
| 4 | _________________________________ | ⬜ Done ⬜ Partial ⬜ Not Started | _______________ |
| 5 | _________________________________ | ⬜ Done ⬜ Partial ⬜ Not Started | _______________ |

**If something didn't get done — what happened?**  
_____________________________________________

**Was my Sunday plan realistic?**  
- [ ] Yes — I estimated well
- [ ] Too ambitious — I set too many goals
- [ ] Too easy — I finished early and could have done more
- [ ] Mixed — some goals were right, others were off

### Week Summary

**Hours I put in this week (approx.)**: _____ hours

**My biggest strength this week**: _______________

**The skill I most need to level up**: _______________

**If I had to give myself a grade this week (A-F)**: _____  
**Why?**: _______________

**What I want to focus on next week** (this feeds into Sunday's plan):  
_____________________________________________

---

> 📌 **Cadence Reminder:**  
> 🟦 **Sunday** → Fill out the Weekly Plan (set goals)  
> 🟧 **Tuesday** → Fill out this check-in (skip the Thursday section)  
> 🟥 **Thursday** → Fill out this check-in + the Weekly Goal Review section  
>  
> 💬 *"The person who writes the most specific reflection gets the most accurate progress report."*
