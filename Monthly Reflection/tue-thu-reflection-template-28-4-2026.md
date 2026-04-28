# 🧠 Reflection Check-In — 9XAI Fellowship

> ⏱️ **Estimated time to complete: 10–15 minutes**  
> Fill this out **twice per week** — on **Tuesday** (mid-week) and **Thursday** (end of week).  
> Be honest — the more specific you are, the better we can support you.

---

## 📋 The Basics

**Your Name**: Abdalrhman Dmour 
**Date**: 28-4-2026
**This is my**:  ✅ Tuesday check-in ⬜ Thursday check-in

---

## 🎯 What I Actually Did Since Last Check-In

> Don't overthink this — just list the concrete things you worked on. Be specific.  
> ❌ Bad: "Worked on the project"  
> ✅ Good: "Built the JWT auth system with bcrypt + 24h token expiry"

### Tasks I completed or made progress on

1. Fixed and improved the dashboard’s map view to be a true top-down 2D (bird’s-eye) layout, removing all tilt and perspective.
2. build the "AI What-If Decision" as a WOW feature for the System, making sure it clearly compares the current and recommended traffic plans.
3. Refined the vehicle movemen t system to handle dynamic corridor recreations without bugs.
4. Explained and documented how the system determines the most congested direction at the intersection.
5. Validated the camera vehicle count feature, ensuring it accurately shows live detected vehicles by type and status.

### Pick ONE of the tasks above and tell me more

> This helps us understand how you think, not just what you shipped.

Task 2 : build the "AI What-If Decision" as a WOW feature for the System, making sure it clearly compares the current and recommended traffic plans.

**What tools/technologies did you use?** To build the AI What-If Decision feature, I used:

Vanilla JavaScript for all the frontend logic and UI updates.
HTML5 and CSS to design the panel, style the comparison cards, and make the interface clear and visually appealing.
HTML5 Canvas for rendering supporting graphics and overlays.
Python on the backend to process live traffic data and generate AI recommendations.
YOLO for real-time vehicle detection, which feeds into the analytics.
Google Routes API to get live traffic speeds and delays, which are used in the impact estimation.
SQLite for storing historical data and audit logs, ensuring the system can track and validate recommendations.

**Why did you build it THIS way?** I built the What-If Decision feature as a pure JavaScript component for several reasons:

Instant feedback: By doing the calculations and UI updates directly in the browser, operators get immediate, interactive results when they preview a recommendation.
Full control over the UI: Using vanilla JS and custom CSS allowed me to design the panel exactly how I wanted, with a clear side-by-side comparison and color-coded risk levels, without being limited by a third-party component library.
Lightweight and maintainable: Avoiding heavy frameworks or mapping libraries kept the dashboard fast and easy to maintain.
Separation of concerns: The backend focuses on data and recommendations, while the frontend handles visualization and user interaction. This makes the system more robust and easier to debug.
Operator trust: By making the feature strictly advisory (no automatic control), I ensured that human operators always have the final say, which is important for real-world deployments.

### Which project(s) did you contribute to?

**Primary project**: Wadi Saqra Intelligent Traffic Light Dashboard  
**Did you contribute to any other project?**  
- [x] No — focused on my main project only  
- [ ] Yes → Which one(s)? _______________

---

## 🔥 The Hardest Problem I Faced

**What was the problem?**  
Integrating the YOLO detection system with the real-time video feed from the intersection cameras proved more complex than anticipated. Initially, I focused on the backend logic for traffic light control, but I realized that without accurate vehicle detection and classification, the system couldn't make intelligent decisions. The challenge was to process high-resolution video streams and identify vehicles with minimal latency while maintaining a high degree of accuracy. Also another problem was the map view to be a true top-down 2D (bird’s-eye) layout, removing all tilt and perspective. , also when I want to change on anything on the frontend , alot of bugs happen on the system, so these are the most problems I faced , also problems in understanding the project requirements and the system architecture and the best way to implement the features.because it is a very new thing to me and also the system is very complex with many features and integrations.

**How did you discover it?**
- [x] I found it myself while working
- [ ] A teammate told me about it
- [ ] It came up in testing
- [ ] The program manager / mentor pointed it out
- [ ] A user / demo found it
- [ ] Other: _______________

**Walk me through what you did to fix it** (step by step — like you're explaining to a friend)  


 1. **Integrating YOLO with Real-Time Video**

**Step 1:** I started by reading about how YOLO works and how it can process video frames to detect vehicles.  
**Step 2:** I set up the backend to grab frames from the intersection camera feed and send them to the YOLO model for detection.  
**Step 3:** I noticed the system was slow, so I worked on resizing the video frames and adjusting the detection settings to make it faster without losing too much accuracy.  
**Step 4:** I added logic to track vehicles across frames, so the system wouldn’t double-count cars or lose track of them when they moved.  
**Step 5:** I tested the detection results and tweaked the confidence thresholds until the system was reliably picking up all vehicles, even in busy scenes.

---

### 2. **Making the Map a True Top-Down 2D View**

**Step 1:** I looked through all the code that draws the map to find any settings or math that added tilt or perspective.  
**Step 2:** I removed any code that rotated or skewed the map, and made sure the projection was just a simple scale and shift—no fancy angles.  
**Step 3:** I set the default zoom and center so the intersection always appears flat and from directly above.  
**Step 4:** I checked the map in the browser and made small adjustments until it looked exactly like a traffic engineer’s map.

---

### 3. **Frontend Bugs When Making Changes**

**Step 1:** Whenever I changed something on the frontend and a bug appeared, I used the browser’s developer tools to look for errors and see what broke.  
**Step 2:** I fixed one bug at a time, usually by reading the error message, finding the line in the code, and either correcting a typo or fixing the logic.  
**Step 3:** I refreshed the page after each fix to make sure nothing else broke, and sometimes I wrote small test cases to check the new behavior.  
**Step 4:** If a bug was really stubborn, I would comment out the new code and add it back in piece by piece to see exactly where the problem was.

---

### 4. **Understanding Requirements and System Architecture**

**Step 1:** I read through all the documentation and project notes to get a sense of what the system was supposed to do.  
**Step 2:** I drew a simple diagram for myself showing how the different parts (frontend, backend, YOLO, SUMO, Google API) connect and talk to each other.  
**Step 3:** I wrote down questions whenever I was confused, and tried to answer them by looking at the code or searching online.  
**Step 4:** I started with small, simple changes to build my confidence, and only tackled the bigger features once I felt I understood the basics.

---

**In summary:**  
I broke each big problem into smaller steps, used tools to help me debug, and made sure to test each change as I went. I also spent extra time understanding how all the parts fit together, which made it easier to fix bugs and add new features later.

**How long did it take?**  
- [ ] Under 1 hour
- [ ] 1-3 hours  
- [ ] Half a day
- [x] More than a day
- [ ] Still working on it

**Did the fix prevent it from happening again, or was it a quick patch?**  
- [ ] Permanent fix — it won't happen again
- [x] Temporary — might need revisiting
- [ ] Not sure

---

## 📈 Skill Check

> Be real with yourself. Rate your **current comfort level** (not where you want to be).

| Skill | Comfort Level (1-5) | Did it improve since last check-in? |
|---|:---:|:---:|
| Python / Backend (FastAPI, etc.) | ⬜1 ⬜2 ⬜3 ✅4 ⬜5 | ✅ Yes ⬜ No ⬜ N/A |
| Frontend (React, TypeScript, etc.) | ⬜1 ⬜2 ✅ 3 ⬜4 ⬜5 | ⬜ Yes ✅ No ⬜ N/A |
| AI/ML (RAG, Embeddings, Agents) | ⬜1 ✅ 2 ⬜3 ⬜4 ⬜5 | ⬜ Yes ✅ No ⬜ N/A |
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
Name: Ezz ,Issa , Ahmad Qalalweh 
What you did: We discussed some ideas and tried to find solutions for the problems we faced, and we tried to fix them together.

**Did you help someone who was stuck? What was the situation?**  
No 

**Did someone help YOU when you were stuck? What happened?**  
Not today , but usually they do. Thanks to them I was able to fix the problems I faced in the begininng.

**Did you contribute to a group outside your primary project?**  
- [✅] No — focused on my main project
- [ ] Yes → Which group? _______________  
  What exactly did you do for them? _______________

---

## 💡 The "Aha!" Moment

> What's one thing you learned since your last check-in that clicked — something you didn't understand before but now you do?  
> Try to explain it like you'd explain it to a friend who's not in the program.

Today had many “Aha!” moments for me. One of the most important things I learned was from my friend Karam, who explained what Docker is and how it can help when building systems. Before, Docker was not fully clear to me, but now I understand that it can make the project easier to run, organize, and share with teammates because everyone can work in the same environment without facing many setup problems.

Bisharah also shared very valuable advice about how to implement our project in a stronger and more professional way. One idea that really clicked for me was the “Time Machine” concept in AI. The idea is to use historical data, control the time period, analyze what happened before, and then use prediction models to estimate what may happen next. This can be very useful for decision-makers because it gives them a clearer view of the future based on real data, not just assumptions.

I also learned more about the YOLO concept and how powerful it is in computer vision projects. I now understand that YOLO can detect objects quickly and accurately, which makes it very useful for systems that depend on video analysis, such as traffic monitoring and car detection.

Another valuable part of today was the cybersecurity information Bisharah shared. Since cybersecurity is related to my major, the tools, techniques, and advice he gave us were very useful and could benefit me in future projects.

After watching my teammates’ presentations, the whole project became much clearer to me. I also discovered many strong features and ideas that I can add to my own system to make it better. Overall, today was full of learning moments, and many things that were confusing before finally started to make sense.

## 🚧 What's Blocking Me

> Be honest. If nothing is blocking you, write "Nothing — I'm clear."
**Is anything slowing you down right now?**  
I must know about the workflow between the system and how to build it 

**What have you already tried to unblock yourself?**  
I asked the AI , Teammates to help me understand the workflow and how to build it. 

**What would help you move faster?**  
- [x] More time
- [ ] Pair-programming with a specific teammate
- [ ] A mentor/coach session on a specific topic
- [ ] Better documentation / clearer requirements
- [ ] Access to tools/accounts/APIs
- [ ] Nothing — I'm good
- [ ] Other: _______________

---

## ⚡ Quick Fire Round

> Don't think. Just write the first thing that comes to mind.

**Since last check-in I'm most proud of**: I have earned alot of information about the computer vision field and AI, like what is YOLO , what is annotations , how to detect objects , also how to predict the future using historical data , also some knowledge about cybersecurity and how to protect systems from attacks. also how to use the ML in the project .

**The decision I made that had the biggest impact**: To try to do these things alone without any help from my teammates , but i learned it the hard way that it is better to ask for help when i need it.

**One thing I wish I handled differently**: to understand more and more about the project and know more about the computer vision field and AI.

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
