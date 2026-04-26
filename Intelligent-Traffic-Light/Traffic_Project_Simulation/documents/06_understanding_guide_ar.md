# 06 Understanding Guide (Arabic)

## شو عملنا بهذا الفولدر؟
أنشأنا simulation كامل للمشروع، وليس فقط dashboard شكلية.
الفكرة أن نحول ملفات الـ sandbox الموجودة إلى شيء يمكن عرضه كأنه نظام تشغيل فعلي لتقاطع وادي صقرة.

## كيف يشتغل؟
1. نقرأ ملفات الـ detector data.
2. نقرأ signal logs.
3. نقرأ annotations.
4. نقرأ metadata.
5. نقرأ الفيديو الموجود في `live_stream`.
6. نبني dataset موحد للعرض.
7. نشغل local server.
8. نعرض dashboard فيها تشغيل زمني وسيناريوهات وتنبيهات.

## ليش اخترنا هذا التصميم؟
لأن المطلوب اليوم هو simulation جاهزة ومفهومة وسهلة العرض.
لو دخلنا مباشرة في stack معقدة جداً أو database أو خدمات كثيرة، سنزيد المخاطر على التسليم.
هذا التصميم يعطيك:
1. شيء شغال فعلاً
2. كود واضح ومفهوم
3. قابلية توسعة للمرحلة القادمة

## كيف تشرحها بسرعة؟
احكي:
"أنا أخذت الـ sandbox data الحالية وربطتها مع signal logs والـ annotations وعملت منها simulation dashboard محلية.
الداشبورد تعرض live-like CCTV panel، current traffic KPIs، signal phases، scenarios، alerts، وكلها مبنية على نفس ملفات الـ sandbox.
هيك صار عندي demo كامل للمشروع بدل ما يكون عندي فقط CSV files."

## شو المهم تعرفه عن الفيديو؟
حالياً الفيديو المستخدم هو الفيديو المحلي الموجود داخل `live_stream`.
نحن نعرضه داخل واجهة مصممة لتعطي إحساس CCTV.
في المرحلة القادمة يمكن استبداله بسهولة بـ:
1. فيديوهات متعددة
2. RTSP stream حقيقي
3. historical clips حسب السيناريو

## شو الجاي بعدين؟
1. forecasting model
2. video analytics
3. incident detection
4. adaptive signal recommendation
5. operator workflow integration
