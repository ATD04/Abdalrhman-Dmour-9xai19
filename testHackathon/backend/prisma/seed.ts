import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/digital_twin';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  await prisma.$executeRaw`TRUNCATE TABLE "alerts", "follow_ups", "decisions", "agenda_items", "meeting_participants", "meetings", "blockers", "dependencies", "feedback", "policy_impacts", "policy_options", "policies", "readiness_scores", "friction_incidents", "service_journey_steps", "services", "risks", "milestones", "initiatives", "entities" RESTART IDENTITY CASCADE`;

  // ============================================
  // ENTITIES (Ministries and Agencies)
  // ============================================
  const entities = await Promise.all([
    prisma.entity.create({
      data: {
        nameEn: 'Ministry of Digital Economy and Entrepreneurship',
        nameAr: 'وزارة الاقتصاد الرقمي والريادة',
        type: 'MINISTRY',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Ministry of Finance',
        nameAr: 'وزارة المالية',
        type: 'MINISTRY',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Ministry of Health',
        nameAr: 'وزارة الصحة',
        type: 'MINISTRY',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Ministry of Education',
        nameAr: 'وزارة التربية والتعليم',
        type: 'MINISTRY',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Ministry of Labor',
        nameAr: 'وزارة العمل',
        type: 'MINISTRY',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Civil Service Bureau',
        nameAr: 'ديوان الخدمة المدنية',
        type: 'AGENCY',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Social Security Corporation',
        nameAr: 'المؤسسة العامة للضمان الاجتماعي',
        type: 'CORPORATION',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Greater Amman Municipality',
        nameAr: 'أمانة عمان الكبرى',
        type: 'MUNICIPALITY',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Income and Sales Tax Department',
        nameAr: 'دائرة ضريبة الدخل والمبيعات',
        type: 'DEPARTMENT',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Civil Status and Passports Department',
        nameAr: 'دائرة الأحوال المدنية والجوازات',
        type: 'DEPARTMENT',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Companies Control Department',
        nameAr: 'دائرة مراقبة الشركات',
        type: 'DEPARTMENT',
        status: 'ACTIVE',
      },
    }),
    prisma.entity.create({
      data: {
        nameEn: 'Land and Survey Department',
        nameAr: 'دائرة الأراضي والمساحة',
        type: 'DEPARTMENT',
        status: 'ACTIVE',
      },
    }),
  ]);

  console.log(`✅ Created ${entities.length} entities`);

  // ============================================
  // INITIATIVES
  // ============================================
  const initiatives = await Promise.all([
    prisma.initiative.create({
      data: {
        titleEn: 'Digital Services Modernization',
        titleAr: 'تحديث الخدمات الرقمية',
        descriptionEn: 'Transform 50 high-impact services to fully digital',
        descriptionAr: 'تحويل 50 خدمة عالية التأثير إلى خدمات رقمية بالكامل',
        entityId: entities[0].id,
        status: 'AT_RISK',
        priority: 'CRITICAL',
        progress: 45,
        startDate: new Date('2024-01-01'),
        targetDate: new Date('2025-06-30'),
        riskLevel: 'HIGH',
      },
    }),
    prisma.initiative.create({
      data: {
        titleEn: 'Public Procurement Reform',
        titleAr: 'إصلاح المشتريات الحكومية',
        descriptionEn: 'Implement unified e-procurement across all ministries',
        descriptionAr: 'تطبيق المشتريات الإلكترونية الموحدة في جميع الوزارات',
        entityId: entities[1].id,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 60,
        startDate: new Date('2024-03-01'),
        targetDate: new Date('2025-12-31'),
        riskLevel: 'MEDIUM',
      },
    }),
    prisma.initiative.create({
      data: {
        titleEn: 'Healthcare Information System',
        titleAr: 'نظام المعلومات الصحية',
        descriptionEn: 'Unified electronic health records system',
        descriptionAr: 'نظام موحد للسجلات الصحية الإلكترونية',
        entityId: entities[2].id,
        status: 'DELAYED',
        priority: 'HIGH',
        progress: 35,
        startDate: new Date('2023-06-01'),
        targetDate: new Date('2025-03-31'),
        riskLevel: 'CRITICAL',
      },
    }),
    prisma.initiative.create({
      data: {
        titleEn: 'Smart Schools Initiative',
        titleAr: 'مبادرة المدارس الذكية',
        descriptionEn: 'Digital transformation of 500 public schools',
        descriptionAr: 'التحول الرقمي لـ 500 مدرسة حكومية',
        entityId: entities[3].id,
        status: 'ON_TRACK',
        priority: 'HIGH',
        progress: 70,
        startDate: new Date('2024-01-15'),
        targetDate: new Date('2025-08-31'),
        riskLevel: 'LOW',
      },
    }),
    prisma.initiative.create({
      data: {
        titleEn: 'Labor Market Information System',
        titleAr: 'نظام معلومات سوق العمل',
        descriptionEn: 'Real-time labor market data platform',
        descriptionAr: 'منصة بيانات سوق العمل في الوقت الفعلي',
        entityId: entities[4].id,
        status: 'ON_TRACK',
        priority: 'MEDIUM',
        progress: 55,
        startDate: new Date('2024-04-01'),
        targetDate: new Date('2025-09-30'),
        riskLevel: 'LOW',
      },
    }),
    prisma.initiative.create({
      data: {
        titleEn: 'HR Management Modernization',
        titleAr: 'تحديث إدارة الموارد البشرية',
        descriptionEn: 'Digital HR processes across government',
        descriptionAr: 'رقمنة عمليات الموارد البشرية في الحكومة',
        entityId: entities[5].id,
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        progress: 40,
        startDate: new Date('2024-02-01'),
        targetDate: new Date('2025-07-31'),
        riskLevel: 'MEDIUM',
      },
    }),
    prisma.initiative.create({
      data: {
        titleEn: 'Social Protection Digitization',
        titleAr: 'رقمنة الحماية الاجتماعية',
        descriptionEn: 'Digital enrollment and benefits delivery',
        descriptionAr: 'التسجيل الرقمي وتقديم المزايا',
        entityId: entities[6].id,
        status: 'AT_RISK',
        priority: 'HIGH',
        progress: 30,
        startDate: new Date('2024-01-01'),
        targetDate: new Date('2025-04-30'),
        riskLevel: 'HIGH',
      },
    }),
    prisma.initiative.create({
      data: {
        titleEn: 'Smart City Services',
        titleAr: 'خدمات المدينة الذكية',
        descriptionEn: 'Integrated municipal services platform',
        descriptionAr: 'منصة الخدمات البلدية المتكاملة',
        entityId: entities[7].id,
        status: 'ON_TRACK',
        priority: 'MEDIUM',
        progress: 65,
        startDate: new Date('2024-03-15'),
        targetDate: new Date('2025-10-31'),
        riskLevel: 'LOW',
      },
    }),
  ]);

  console.log(`✅ Created ${initiatives.length} initiatives`);

  // ============================================
  // SERVICES
  // ============================================
  const services = await Promise.all([
    prisma.service.create({
      data: {
        nameEn: 'Business License Renewal',
        nameAr: 'تجديد رخصة المهن',
        descriptionEn: 'Annual business license renewal process',
        descriptionAr: 'عملية تجديد رخصة المهن السنوية',
        entityId: entities[7].id,
        category: 'LICENSING',
        digitalStatus: 'PARTIALLY_DIGITAL',
        avgProcessingDays: 12,
        documentsRequired: 7,
        stepsCount: 8,
        annualVolume: 85000,
        frictionScore: 78,
      },
    }),
    prisma.service.create({
      data: {
        nameEn: 'Tax Clearance Certificate',
        nameAr: 'شهادة براءة الذمة الضريبية',
        descriptionEn: 'Certificate confirming tax compliance',
        descriptionAr: 'شهادة تؤكد الامتثال الضريبي',
        entityId: entities[8].id,
        category: 'CERTIFICATES',
        digitalStatus: 'PARTIALLY_DIGITAL',
        avgProcessingDays: 5,
        documentsRequired: 4,
        stepsCount: 5,
        annualVolume: 120000,
        frictionScore: 62,
      },
    }),
    prisma.service.create({
      data: {
        nameEn: 'National ID Issuance',
        nameAr: 'إصدار الهوية الوطنية',
        descriptionEn: 'First-time national ID card issuance',
        descriptionAr: 'إصدار بطاقة الهوية الوطنية لأول مرة',
        entityId: entities[9].id,
        category: 'CITIZEN_SERVICES',
        digitalStatus: 'PARTIALLY_DIGITAL',
        avgProcessingDays: 7,
        documentsRequired: 3,
        stepsCount: 4,
        annualVolume: 200000,
        frictionScore: 45,
      },
    }),
    prisma.service.create({
      data: {
        nameEn: 'Company Registration',
        nameAr: 'تسجيل الشركات',
        descriptionEn: 'New company registration and incorporation',
        descriptionAr: 'تسجيل وتأسيس الشركات الجديدة',
        entityId: entities[10].id,
        category: 'BUSINESS_SERVICES',
        digitalStatus: 'PARTIALLY_DIGITAL',
        avgProcessingDays: 14,
        documentsRequired: 9,
        stepsCount: 10,
        annualVolume: 25000,
        frictionScore: 82,
      },
    }),
    prisma.service.create({
      data: {
        nameEn: 'Property Title Registration',
        nameAr: 'تسجيل سند الملكية',
        descriptionEn: 'Property ownership registration and transfer',
        descriptionAr: 'تسجيل ونقل ملكية العقارات',
        entityId: entities[11].id,
        category: 'REGISTRATION',
        digitalStatus: 'MANUAL',
        avgProcessingDays: 21,
        documentsRequired: 12,
        stepsCount: 15,
        annualVolume: 45000,
        frictionScore: 88,
      },
    }),
    prisma.service.create({
      data: {
        nameEn: 'Work Permit Application',
        nameAr: 'طلب تصريح العمل',
        descriptionEn: 'Work permit for foreign workers',
        descriptionAr: 'تصريح عمل للعمال الأجانب',
        entityId: entities[4].id,
        category: 'PERMITS',
        digitalStatus: 'PARTIALLY_DIGITAL',
        avgProcessingDays: 10,
        documentsRequired: 8,
        stepsCount: 7,
        annualVolume: 150000,
        frictionScore: 71,
      },
    }),
    prisma.service.create({
      data: {
        nameEn: 'Social Security Enrollment',
        nameAr: 'التسجيل في الضمان الاجتماعي',
        descriptionEn: 'New employee social security registration',
        descriptionAr: 'تسجيل الموظفين الجدد في الضمان الاجتماعي',
        entityId: entities[6].id,
        category: 'REGISTRATION',
        digitalStatus: 'FULLY_DIGITAL',
        avgProcessingDays: 3,
        documentsRequired: 3,
        stepsCount: 3,
        annualVolume: 180000,
        frictionScore: 35,
      },
    }),
    prisma.service.create({
      data: {
        nameEn: 'Building Permit Application',
        nameAr: 'طلب رخصة البناء',
        descriptionEn: 'Construction and building permit approval',
        descriptionAr: 'الموافقة على رخصة البناء والتشييد',
        entityId: entities[7].id,
        category: 'PERMITS',
        digitalStatus: 'PARTIALLY_DIGITAL',
        avgProcessingDays: 30,
        documentsRequired: 15,
        stepsCount: 12,
        annualVolume: 20000,
        frictionScore: 85,
      },
    }),
  ]);

  console.log(`✅ Created ${services.length} services`);

  // ============================================
  // FRICTION INCIDENTS
  // ============================================
  await Promise.all([
    prisma.frictionIncident.create({
      data: {
        serviceId: services[0].id,
        titleEn: 'Multiple document submissions required',
        titleAr: 'مطلوب تقديم وثائق متعددة',
        descriptionEn: 'Same documents must be submitted to different departments',
        descriptionAr: 'يجب تقديم نفس الوثائق لأقسام مختلفة',
        frictionType: 'EXCESSIVE_DOCUMENTS',
        severity: 'HIGH',
        rootCause: 'PROCESS',
        status: 'OPEN',
        occurrences: 156,
        recommendationEn: 'Implement document sharing between departments',
        recommendationAr: 'تنفيذ مشاركة الوثائق بين الأقسام',
      },
    }),
    prisma.frictionIncident.create({
      data: {
        serviceId: services[0].id,
        titleEn: 'Long wait times at service counter',
        titleAr: 'أوقات انتظار طويلة في مكتب الخدمة',
        descriptionEn: 'Average wait time exceeds 2 hours',
        descriptionAr: 'متوسط وقت الانتظار يتجاوز ساعتين',
        frictionType: 'LONG_WAIT',
        severity: 'MEDIUM',
        rootCause: 'RESOURCE',
        status: 'IN_REVIEW',
        occurrences: 89,
        recommendationEn: 'Add online appointment booking system',
        recommendationAr: 'إضافة نظام حجز المواعيد عبر الإنترنت',
      },
    }),
    prisma.frictionIncident.create({
      data: {
        serviceId: services[3].id,
        titleEn: 'Unclear requirements list',
        titleAr: 'قائمة متطلبات غير واضحة',
        descriptionEn: 'Requirements change across visits',
        descriptionAr: 'المتطلبات تتغير بين الزيارات',
        frictionType: 'UNCLEAR_REQUIREMENTS',
        severity: 'HIGH',
        rootCause: 'PROCESS',
        status: 'OPEN',
        occurrences: 78,
        recommendationEn: 'Create standardized digital checklist',
        recommendationAr: 'إنشاء قائمة فحص رقمية موحدة',
      },
    }),
    prisma.frictionIncident.create({
      data: {
        serviceId: services[4].id,
        titleEn: 'Manual verification causing delays',
        titleAr: 'التحقق اليدوي يسبب تأخيرات',
        descriptionEn: 'Manual verification between multiple agencies',
        descriptionAr: 'التحقق اليدوي بين عدة جهات',
        frictionType: 'POOR_HANDOFF',
        severity: 'CRITICAL',
        rootCause: 'TECHNICAL',
        status: 'BEING_ADDRESSED',
        occurrences: 234,
        recommendationEn: 'Implement automated inter-agency verification',
        recommendationAr: 'تنفيذ التحقق الآلي بين الجهات',
      },
    }),
    prisma.frictionIncident.create({
      data: {
        serviceId: services[5].id,
        titleEn: 'Multiple physical visits required',
        titleAr: 'مطلوب زيارات شخصية متعددة',
        descriptionEn: 'At least 3 visits needed to complete process',
        descriptionAr: 'مطلوب 3 زيارات على الأقل لإتمام العملية',
        frictionType: 'MULTIPLE_VISITS',
        severity: 'HIGH',
        rootCause: 'PROCESS',
        status: 'OPEN',
        occurrences: 167,
        recommendationEn: 'Enable document upload and reduce to single visit',
        recommendationAr: 'تمكين رفع الوثائق وتقليلها لزيارة واحدة',
      },
    }),
  ]);

  console.log('✅ Created friction incidents');

  // ============================================
  // READINESS SCORES
  // ============================================
  const dimensions = ['GOVERNANCE', 'CAPABILITIES', 'TECHNOLOGY', 'CULTURE', 'LEADERSHIP'];
  
  const readinessData = [
    { entityIdx: 0, scores: [72, 68, 78, 65, 75] },
    { entityIdx: 1, scores: [80, 75, 70, 68, 82] },
    { entityIdx: 2, scores: [55, 48, 52, 45, 60] },
    { entityIdx: 3, scores: [70, 65, 60, 72, 68] },
    { entityIdx: 4, scores: [62, 55, 58, 52, 65] },
    { entityIdx: 5, scores: [75, 70, 65, 60, 72] },
    { entityIdx: 6, scores: [38, 35, 41, 32, 45] },
    { entityIdx: 7, scores: [68, 62, 72, 65, 70] },
    { entityIdx: 8, scores: [60, 55, 58, 50, 62] },
    { entityIdx: 9, scores: [65, 60, 55, 58, 68] },
    { entityIdx: 10, scores: [50, 45, 48, 42, 55] },
    { entityIdx: 11, scores: [42, 38, 35, 40, 48] },
  ];

  for (const data of readinessData) {
    for (let i = 0; i < dimensions.length; i++) {
      await prisma.readinessScore.create({
        data: {
          entityId: entities[data.entityIdx].id,
          dimension: dimensions[i] as any,
          score: data.scores[i],
          assessmentDate: new Date(),
        },
      });
    }
  }

  console.log('✅ Created readiness scores');

  // ============================================
  // POLICIES
  // ============================================
  const policies = await Promise.all([
    prisma.policy.create({
      data: {
        titleEn: 'Unified Business Registry Reform',
        titleAr: 'إصلاح السجل التجاري الموحد',
        descriptionEn: 'Mandate single business registration across all agencies',
        descriptionAr: 'إلزام التسجيل التجاري الموحد عبر جميع الجهات',
        entityId: entities[10].id,
        status: 'UNDER_REVIEW',
        type: 'REFORM',
        priority: 'HIGH',
      },
    }),
    prisma.policy.create({
      data: {
        titleEn: 'Digital-First Service Delivery',
        titleAr: 'الخدمات الرقمية أولاً',
        descriptionEn: 'Require digital channel as primary for all new services',
        descriptionAr: 'إلزام القنوات الرقمية كقناة أساسية لجميع الخدمات الجديدة',
        entityId: entities[0].id,
        status: 'UNDER_REVIEW',
        type: 'DIRECTIVE',
        priority: 'CRITICAL',
      },
    }),
    prisma.policy.create({
      data: {
        titleEn: 'Data Sharing Framework',
        titleAr: 'إطار مشاركة البيانات',
        descriptionEn: 'Enable secure data sharing between government entities',
        descriptionAr: 'تمكين مشاركة البيانات الآمنة بين الجهات الحكومية',
        entityId: entities[0].id,
        status: 'DRAFT',
        type: 'REGULATION',
        priority: 'HIGH',
      },
    }),
  ]);

  // Add policy options
  for (const policy of policies) {
    await prisma.policyOption.createMany({
      data: [
        {
          policyId: policy.id,
          titleEn: 'Full Implementation',
          titleAr: 'التنفيذ الكامل',
          descriptionEn: 'Implement across all entities immediately',
          descriptionAr: 'التنفيذ عبر جميع الجهات فوراً',
          effectiveness: 85,
          equity: 70,
          cost: 80,
          speed: 40,
          risk: 65,
          isRecommended: false,
        },
        {
          policyId: policy.id,
          titleEn: 'Phased Rollout',
          titleAr: 'التنفيذ المرحلي',
          descriptionEn: 'Start with pilot entities, then expand',
          descriptionAr: 'البدء بجهات تجريبية ثم التوسع',
          effectiveness: 75,
          equity: 80,
          cost: 50,
          speed: 70,
          risk: 35,
          isRecommended: true,
        },
      ],
    });

    await prisma.policyImpact.createMany({
      data: [
        {
          policyId: policy.id,
          stakeholderGroup: 'Citizens',
          impactType: 'POSITIVE',
          impactLevel: 'SIGNIFICANT',
          descriptionEn: 'Reduced service time and visits',
          descriptionAr: 'تقليل وقت الخدمة والزيارات',
        },
        {
          policyId: policy.id,
          stakeholderGroup: 'Government Employees',
          impactType: 'MIXED',
          impactLevel: 'MODERATE',
          descriptionEn: 'Change management required',
          descriptionAr: 'يتطلب إدارة التغيير',
        },
      ],
    });
  }

  console.log(`✅ Created ${policies.length} policies with options`);

  // ============================================
  // DEPENDENCIES & BLOCKERS
  // ============================================
  const dependencies = await Promise.all([
    prisma.dependency.create({
      data: {
        initiativeId: initiatives[0].id,
        fromEntityId: entities[0].id,
        toEntityId: entities[5].id,
        titleEn: 'HR System Integration',
        titleAr: 'تكامل نظام الموارد البشرية',
        descriptionEn: 'Requires civil service data access',
        descriptionAr: 'يتطلب الوصول لبيانات الخدمة المدنية',
        type: 'DATA_SHARING',
        status: 'BLOCKED',
        dueDate: new Date('2025-02-28'),
      },
    }),
    prisma.dependency.create({
      data: {
        initiativeId: initiatives[2].id,
        fromEntityId: entities[2].id,
        toEntityId: entities[0].id,
        titleEn: 'National Data Center Migration',
        titleAr: 'ترحيل مركز البيانات الوطني',
        descriptionEn: 'Infrastructure dependency on data center',
        descriptionAr: 'اعتماد البنية التحتية على مركز البيانات',
        type: 'TECHNICAL',
        status: 'IN_PROGRESS',
        dueDate: new Date('2025-03-31'),
      },
    }),
    prisma.dependency.create({
      data: {
        initiativeId: initiatives[1].id,
        fromEntityId: entities[1].id,
        toEntityId: entities[8].id,
        titleEn: 'Tax Integration API',
        titleAr: 'واجهة برمجة تكامل الضرائب',
        descriptionEn: 'API access for procurement tax verification',
        descriptionAr: 'الوصول للواجهة البرمجية للتحقق الضريبي للمشتريات',
        type: 'TECHNICAL',
        status: 'COMPLETED',
        dueDate: new Date('2024-12-31'),
        completedDate: new Date('2024-12-15'),
      },
    }),
    prisma.dependency.create({
      data: {
        initiativeId: initiatives[6].id,
        fromEntityId: entities[6].id,
        toEntityId: entities[4].id,
        titleEn: 'Labor Data Exchange',
        titleAr: 'تبادل بيانات العمل',
        descriptionEn: 'Employment data for benefits verification',
        descriptionAr: 'بيانات التوظيف للتحقق من المزايا',
        type: 'DATA_SHARING',
        status: 'OVERDUE',
        dueDate: new Date('2024-11-30'),
      },
    }),
  ]);

  // Add blockers
  await prisma.blocker.create({
    data: {
      dependencyId: dependencies[0].id,
      titleEn: 'Security Review Pending',
      titleAr: 'مراجعة أمنية معلقة',
      descriptionEn: 'Data sharing agreement requires security audit',
      descriptionAr: 'اتفاقية مشاركة البيانات تتطلب تدقيقاً أمنياً',
      reportedDate: new Date('2024-12-01'),
      escalationLevel: 'SECRETARY_GENERAL',
      status: 'ESCALATED',
    },
  });

  await prisma.blocker.create({
    data: {
      dependencyId: dependencies[3].id,
      titleEn: 'Technical Incompatibility',
      titleAr: 'عدم التوافق التقني',
      descriptionEn: 'Legacy system cannot expose required APIs',
      descriptionAr: 'النظام القديم لا يمكنه توفير الواجهات البرمجية المطلوبة',
      reportedDate: new Date('2024-10-15'),
      escalationLevel: 'MINISTERIAL',
      status: 'IN_PROGRESS',
    },
  });

  console.log(`✅ Created ${dependencies.length} dependencies with blockers`);

  // ============================================
  // FEEDBACK
  // ============================================
  const feedbackThemes = [
    'Long Wait Times',
    'Unclear Requirements',
    'Multiple Visits',
    'Staff Behavior',
    'System Downtime',
    'Missing Documents',
    'Process Complexity',
    'Good Service',
    'Fast Response',
    'Helpful Staff',
  ];

  const feedbackData = [];
  for (let i = 0; i < 200; i++) {
    const sentiment = Math.random() < 0.3 ? 'POSITIVE' : Math.random() < 0.6 ? 'NEGATIVE' : 'NEUTRAL';
    const serviceIdx = Math.floor(Math.random() * services.length);
    const themes = [
      feedbackThemes[Math.floor(Math.random() * (sentiment === 'POSITIVE' ? 3 : 7) + (sentiment === 'POSITIVE' ? 7 : 0))],
    ];
    if (Math.random() > 0.5) {
      themes.push(feedbackThemes[Math.floor(Math.random() * feedbackThemes.length)]);
    }

    feedbackData.push({
      entityId: services[serviceIdx].entityId,
      serviceId: services[serviceIdx].id,
      source: ['COMPLAINT', 'SUGGESTION', 'INQUIRY', 'SURVEY'][Math.floor(Math.random() * 4)] as any,
      channel: ['ONLINE_PORTAL', 'CALL_CENTER', 'SOCIAL_MEDIA', 'EMAIL'][Math.floor(Math.random() * 4)] as any,
      contentEn: sentiment === 'POSITIVE' 
        ? 'Service was efficient and staff were helpful' 
        : 'Had to wait long and make multiple visits',
      contentAr: sentiment === 'POSITIVE'
        ? 'كانت الخدمة فعالة والموظفون متعاونون'
        : 'اضطررت للانتظار طويلاً وعمل زيارات متعددة',
      sentiment: sentiment as any,
      themes,
      priority: sentiment === 'NEGATIVE' ? 'HIGH' : 'MEDIUM' as any,
      status: 'NEW' as any,
      receivedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    });
  }

  await prisma.feedback.createMany({ data: feedbackData });
  console.log(`✅ Created ${feedbackData.length} feedback items`);

  // ============================================
  // MEETINGS
  // ============================================
  const meetings = await Promise.all([
    prisma.meeting.create({
      data: {
        titleEn: 'Modernization Steering Committee',
        titleAr: 'لجنة توجيه التحديث',
        descriptionEn: 'Quarterly review of modernization progress',
        descriptionAr: 'المراجعة الربعية لتقدم التحديث',
        meetingType: 'STEERING_COMMITTEE',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        duration: 120,
        location: 'Prime Ministry, Conference Room A',
        status: 'SCHEDULED',
        briefingNotesEn: 'Key topics: Digital services progress, Healthcare system delays, Cross-entity coordination',
        briefingNotesAr: 'المواضيع الرئيسية: تقدم الخدمات الرقمية، تأخيرات النظام الصحي، التنسيق بين الجهات',
      },
    }),
    prisma.meeting.create({
      data: {
        titleEn: 'Digital Services Progress Review',
        titleAr: 'مراجعة تقدم الخدمات الرقمية',
        descriptionEn: 'Review of digital transformation initiatives',
        descriptionAr: 'مراجعة مبادرات التحول الرقمي',
        meetingType: 'MINISTERIAL_REVIEW',
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        duration: 90,
        location: 'Ministry of Digital Economy',
        status: 'SCHEDULED',
        briefingNotesEn: 'Focus on at-risk initiatives and recovery plans',
        briefingNotesAr: 'التركيز على المبادرات المعرضة للخطر وخطط التعافي',
      },
    }),
    prisma.meeting.create({
      data: {
        titleEn: 'Cross-Entity Coordination Workshop',
        titleAr: 'ورشة التنسيق بين الجهات',
        descriptionEn: 'Address coordination blockers',
        descriptionAr: 'معالجة معوقات التنسيق',
        meetingType: 'WORKING_GROUP',
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        duration: 180,
        location: 'Virtual',
        status: 'SCHEDULED',
      },
    }),
  ]);

  // Add agenda items
  await prisma.agendaItem.createMany({
    data: [
      {
        meetingId: meetings[0].id,
        orderNumber: 1,
        titleEn: 'Initiative Progress Dashboard Review',
        titleAr: 'مراجعة لوحة تقدم المبادرات',
        presenter: 'Director of Modernization',
        duration: 20,
      },
      {
        meetingId: meetings[0].id,
        orderNumber: 2,
        titleEn: 'Healthcare System Recovery Plan',
        titleAr: 'خطة تعافي النظام الصحي',
        presenter: 'Ministry of Health Representative',
        duration: 30,
      },
      {
        meetingId: meetings[0].id,
        orderNumber: 3,
        titleEn: 'Cross-Entity Blockers Resolution',
        titleAr: 'حل معوقات التنسيق بين الجهات',
        presenter: 'Coordination Office',
        duration: 25,
      },
      {
        meetingId: meetings[0].id,
        orderNumber: 4,
        titleEn: 'Citizen Feedback Summary',
        titleAr: 'ملخص آراء المواطنين',
        presenter: 'Public Relations',
        duration: 15,
      },
    ],
  });

  // Add decisions from previous meetings
  await prisma.decision.createMany({
    data: [
      {
        meetingId: meetings[0].id,
        titleEn: 'Approve emergency support for Social Security digitization',
        titleAr: 'الموافقة على دعم طارئ لرقمنة الضمان الاجتماعي',
        decisionType: 'APPROVAL',
        priority: 'HIGH',
        owner: 'Secretary General, SSC',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
      },
      {
        meetingId: meetings[0].id,
        titleEn: 'Escalate data center delay to Cabinet',
        titleAr: 'تصعيد تأخير مركز البيانات لمجلس الوزراء',
        decisionType: 'ESCALATION',
        priority: 'CRITICAL',
        owner: 'Minister of Digital Economy',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'IN_PROGRESS',
      },
    ],
  });

  // Add follow-ups
  await prisma.followUp.createMany({
    data: [
      {
        meetingId: meetings[0].id,
        titleEn: 'Prepare detailed recovery plan for healthcare initiative',
        titleAr: 'إعداد خطة تعافي مفصلة لمبادرة الرعاية الصحية',
        owner: 'Ministry of Health Team',
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        priority: 'HIGH',
        status: 'PENDING',
      },
      {
        meetingId: meetings[0].id,
        titleEn: 'Coordinate security review for HR data sharing',
        titleAr: 'تنسيق المراجعة الأمنية لمشاركة بيانات الموارد البشرية',
        owner: 'National Cyber Security Center',
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
      },
      {
        meetingId: meetings[0].id,
        titleEn: 'Submit quarterly citizen feedback report',
        titleAr: 'تقديم تقرير آراء المواطنين الربعي',
        owner: 'Public Relations Office',
        deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Overdue
        priority: 'MEDIUM',
        status: 'PENDING',
      },
    ],
  });

  console.log(`✅ Created ${meetings.length} meetings with agenda and follow-ups`);

  // ============================================
  // ALERTS
  // ============================================
  await prisma.alert.createMany({
    data: [
      {
        initiativeId: initiatives[2].id,
        type: 'SLIPPAGE',
        severity: 'CRITICAL',
        titleEn: 'Healthcare System Initiative Critical Delay',
        titleAr: 'تأخير حرج في مبادرة النظام الصحي',
        descriptionEn: 'Initiative is 35% behind schedule with critical dependencies',
        descriptionAr: 'المبادرة متأخرة 35% عن الجدول مع تبعيات حرجة',
        source: 'Executive Radar',
        status: 'ACTIVE',
      },
      {
        type: 'BLOCKER',
        severity: 'HIGH',
        titleEn: 'Ministerial-Level Blocker Requires Attention',
        titleAr: 'معوق على المستوى الوزاري يتطلب اهتماماً',
        descriptionEn: 'Technical blocker escalated to ministerial level - 45 days open',
        descriptionAr: 'معوق تقني مصعد للمستوى الوزاري - 45 يوماً مفتوح',
        source: 'Cross-Entity Coordination',
        status: 'ACTIVE',
      },
      {
        type: 'CITIZEN_SIGNAL',
        severity: 'MEDIUM',
        titleEn: 'Rising Complaints on Business License Service',
        titleAr: 'ارتفاع الشكاوى على خدمة رخصة المهن',
        descriptionEn: '23% increase in negative feedback over past 30 days',
        descriptionAr: 'زيادة 23% في التغذية الراجعة السلبية خلال 30 يوماً الماضية',
        source: 'Citizen Voice',
        status: 'ACTIVE',
      },
      {
        type: 'READINESS',
        severity: 'HIGH',
        titleEn: 'Social Security Corporation Low Readiness',
        titleAr: 'جاهزية منخفضة للمؤسسة العامة للضمان الاجتماعي',
        descriptionEn: 'Average readiness score of 38% may impact initiative success',
        descriptionAr: 'متوسط درجة الجاهزية 38% قد يؤثر على نجاح المبادرة',
        source: 'Readiness Analyzer',
        status: 'ACTIVE',
      },
    ],
  });

  console.log('✅ Created alerts');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
