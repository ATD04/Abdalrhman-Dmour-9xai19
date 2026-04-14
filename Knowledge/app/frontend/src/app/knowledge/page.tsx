"use client";
import { AppShell } from "@/components/AppShell";
import {
  StatCard,
  StatusBadge,
  MinistryTag,
  PageHeader,
  Button,
  EmptyState,
  SkeletonCard,
  Input,
  Select,
  Alert,
  Card,
  Stack,
  Grid,
} from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Upload,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Database,
  Activity,
  Star,
  X,
  TrendingUp,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "@/components/AppShell";
import { knowledgeService, type SourceInfo } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type FilterState = {
  searchQuery: string;
  docType: string;
  sector: string;
  visibility: string;
  language: string;
  useSemantic: boolean;
};

type SearchResult = SourceInfo & {
  relevanceScore?: number;
  excerpt?: string;
};

export default function KnowledgeLibraryPage() {
  const { lang } = useApp();
  const isAr = lang === "ar";
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    docType: "",
    sector: "",
    visibility: "",
    language: "",
    useSemantic: false,
  });

  // Fetch all sources
  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await knowledgeService.listSources();
      setSources(data.sources ?? []);
      setSearchResults(data.sources ?? []);
    } catch (err) {
      setError(
        isAr
          ? "فشل تحميل الوثائق"
          : "Failed to load documents"
      );
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // Semantic search function
  const performSemanticSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults(sources);
        return;
      }

      setSearching(true);
      try {
        const result = await knowledgeService.retrieve({
          query,
          top_k: 50,
          doc_type: filters.docType || undefined,
          sector: filters.sector || undefined,
          visibility: (filters.visibility as any) || undefined,
        });

        // Convert chunks to unique sources with relevance
        const uniqueSources = new Map<string, SearchResult>();
        result.chunks?.forEach((chunk) => {
          if (!uniqueSources.has(chunk.source_id)) {
            uniqueSources.set(chunk.source_id, {
              source_id: chunk.source_id,
              source_name: chunk.source_name,
              filename: chunk.filename,
              file_type: "PDF",
              doc_type: "document",
              total_chunks: 0,
              current_version: chunk.version,
              tags: [],
              language: "ar",
              visibility: "public",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              relevanceScore: chunk.score,
              excerpt: chunk.text.substring(0, 200),
            });
          }
        });

        setSearchResults(Array.from(uniqueSources.values()));
      } catch (err) {
        setError(
          isAr
            ? "فشل البحث في الوثائق"
            : "Failed to search documents"
        );
      } finally {
        setSearching(false);
      }
    },
    [sources, filters, isAr]
  );

  // Handle search input with debouncing
  const handleSearch = useCallback(
    (query: string) => {
      setFilters((prev) => ({ ...prev, searchQuery: query }));
    },
    []
  );

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.searchQuery.trim()) {
        performSemanticSearch(filters.searchQuery);
      } else {
        setSearchResults(sources);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.searchQuery, performSemanticSearch, sources]);

  // Apply local filters
  const filteredResults = useMemo(() => {
    return searchResults.filter((doc) => {
      if (filters.docType && doc.doc_type !== filters.docType)
        return false;
      if (filters.language && doc.language !== filters.language)
        return false;
      if (filters.visibility && doc.visibility !== filters.visibility)
        return false;
      return true;
    });
  }, [searchResults, filters.docType, filters.language, filters.visibility]);

  const published = sources.length;
  const totalChunks = sources.reduce((acc, d) => acc + d.total_chunks, 0);
  const stats = useMemo(
    () => ({
      published,
      queued: 0,
      chunks: totalChunks,
      quality: 94,
    }),
    [published, totalChunks]
  );

  const clearFilters = () => {
    setFilters({
      searchQuery: "",
      docType: "",
      sector: "",
      visibility: "",
      language: "",
      useSemantic: false,
    });
  };

  const activeFilterCount =
    [
      filters.searchQuery,
      filters.docType,
      filters.sector,
      filters.visibility,
      filters.language,
    ].filter(Boolean).length;

  const handleDeleteSource = useCallback(
    async (doc: Pick<SourceInfo, "source_id" | "source_name">) => {
      const confirmed = window.confirm(
        isAr
          ? `هل تريد حذف الوثيقة "${doc.source_name}"؟ لا يمكن التراجع عن هذا الإجراء.`
          : `Do you want to delete "${doc.source_name}"? This action cannot be undone.`
      );
      if (!confirmed) return;

      setDeletingSourceId(doc.source_id);
      setError(null);
      try {
        await knowledgeService.deleteSource(doc.source_id);
        setSources((prev) => prev.filter((item) => item.source_id !== doc.source_id));
        setSearchResults((prev) => prev.filter((item) => item.source_id !== doc.source_id));
      } catch (err) {
        setError(isAr ? "فشل حذف الوثيقة" : "Failed to delete document");
      } finally {
        setDeletingSourceId(null);
      }
    },
    [isAr]
  );

  return (
    <ProtectedRoute allowed={["operator", "admin"]} requireAuth>
    <AppShell title={isAr ? "إدارة المعرفة" : "Knowledge Management"}>
      <div className="page-container space-y-6" style={{ maxWidth: 1240 }}>
        <PageHeader
          title={isAr ? "مكتبة الوثائق" : "Documents Library"}
          subtitle={isAr
            ? "البحث الدلالي والتصفية المتقدمة - استكشف قاعدة المعرفة الشاملة"
            : "Semantic search & advanced filtering — explore the comprehensive knowledge base"}
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => fetchSources()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-stone-50 transition-colors"
              >
                <RefreshCw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                {isAr ? "تحديث" : "Refresh"}
              </button>
              <Link href="/knowledge/upload">
                <Button size="sm" icon={Upload}>
                  {isAr ? "رفع وثيقة" : "Upload Document"}
                </Button>
              </Link>
            </div>
          }
        />

        <div className="hero-banner">
          <div className="hero-banner-content">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-primary mb-2">
              {isAr ? "مركز المعرفة" : "Knowledge Intelligence"}
            </div>
            <div className="remaster-page-title mb-2">
              {isAr ? "استكشف الوثائق الرسمية بسرعة ودقة" : "Explore Official Documents With Speed and Precision"}
            </div>
            <div className="text-secondary text-sm max-w-3xl">
              {isAr ? "بحث دلالي، تصفية متقدمة، ونتائج مهيكلة تساعد فرق المعرفة على الوصول للمعلومة الصحيحة بسرعة." : "Semantic search, advanced filters, and structured results that help teams find the right source faster."}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="remaster-kpi-strip">
          <StatCard
            title={isAr ? "الوثائق المنشورة" : "Published Documents"}
            value={stats.published}
            icon={FileText}
            iconColor="var(--text-primary)"
          />
          <StatCard
            title={isAr ? "قائمة المعالجة" : "Processing Queue"}
            value={stats.queued}
            icon={Activity}
            iconColor="var(--text-secondary)"
          />
          <StatCard
            title={isAr ? "إجمالي الأجزاء" : "Total Chunks"}
            value={stats.chunks.toLocaleString()}
            icon={Database}
            iconColor="var(--text-primary)"
          />
          <StatCard
            title={isAr ? "متوسط الجودة" : "Avg. Quality"}
            value="94%"
            icon={Star}
            iconColor="var(--text-secondary)"
          />
        </div>

        {error && (
          <Alert variant="error" title={isAr ? "خطأ" : "Error"} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Search & Filter Section */}
        <Card className="surface-card" padding="lg">
          <Stack direction="column" gap="md">
            {/* Search Bar */}
            <div className="flex gap-3">
              <Input
                placeholder={isAr ? "ابحث في الوثائق..." : "Search documents..."}
                icon={Search}
                value={filters.searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2.5 rounded-lg border flex items-center gap-2 text-sm font-medium transition-colors hover:bg-gray-50"
              >
                <Filter size={16} />
                {isAr ? "تصفية" : "Filter"}
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Advanced Filters */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t pt-4"
                >
                  <Grid columns={2} gap="md" className="sm:grid-cols-1">
                    <Select
                      label={isAr ? "نوع الوثيقة" : "Document Type"}
                      options={[
                        { value: "", label: isAr ? "الكل" : "All Types" },
                        { value: "law", label: isAr ? "قانون" : "Law" },
                        { value: "regulation", label: isAr ? "لائحة" : "Regulation" },
                        { value: "policy", label: isAr ? "سياسة" : "Policy" },
                        { value: "directive", label: isAr ? "توجيه" : "Directive" },
                      ]}
                      value={filters.docType}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          docType: e.target.value,
                        }))
                      }
                    />
                    <Select
                      label={isAr ? "الرؤية" : "Visibility"}
                      options={[
                        { value: "", label: isAr ? "الكل" : "All" },
                        { value: "public", label: isAr ? "عام" : "Public" },
                        { value: "internal", label: isAr ? "داخلي" : "Internal" },
                        { value: "confidential", label: isAr ? "سري" : "Confidential" },
                      ]}
                      value={filters.visibility}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          visibility: e.target.value,
                        }))
                      }
                    />
                    <Select
                      label={isAr ? "اللغة" : "Language"}
                      options={[
                        { value: "", label: isAr ? "الكل" : "All Languages" },
                        { value: "ar", label: "العربية" },
                        { value: "en", label: "English" },
                      ]}
                      value={filters.language}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          language: e.target.value,
                        }))
                      }
                    />
                    {activeFilterCount > 0 && (
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearFilters}
                          icon={X}
                        >
                          {isAr ? "مسح الفلاتر" : "Clear Filters"}
                        </Button>
                      </div>
                    )}
                  </Grid>
                </motion.div>
              )}
            </AnimatePresence>
          </Stack>
        </Card>

        {/* Results Section */}
        {searching && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Search size={32} className="text-navy-royal" />
              </motion.div>
              <p className="text-sm text-gray-600">
                {isAr ? "جاري البحث..." : "Searching..."}
              </p>
            </div>
          </div>
        )}

        {!searching && loading && sources.length === 0 ? (
          <Grid columns={3}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </Grid>
        ) : !searching && filteredResults.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={isAr ? "لا توجد وثائق" : "No documents found"}
            description={
              filters.searchQuery
                ? isAr
                  ? "حاول تغيير عبارة البحث أو الفلاتر"
                  : "Try changing your search query or filters"
                : isAr
                ? "ابدأ برفع وثائق رسمية لتغذية قاعدة المعرفة"
                : "Start by uploading official documents to feed the knowledge base"
            }
            action={
              !filters.searchQuery ? (
                <Link href="/knowledge/upload">
                  <Button size="sm" icon={Upload}>
                    {isAr ? "رفع أول وثيقة" : "Upload First Document"}
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredResults.map((doc) => (
              <motion.div
                key={doc.source_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card hover className="surface-card-hover h-full flex flex-col gap-3 cursor-pointer transition-all" padding="md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status="published" size="sm" />
                        {doc.relevanceScore && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 font-medium flex items-center gap-1">
                            <TrendingUp size={11} />
                            {Math.round(doc.relevanceScore * 100)}%
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm leading-snug break-words line-clamp-2 mb-1">
                        {doc.source_name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteSource(doc);
                        }}
                        disabled={deletingSourceId === doc.source_id}
                        className="h-7 w-7 rounded-md border border-red-200 text-red-600 flex items-center justify-center transition-colors hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                        title={isAr ? "حذف الوثيقة" : "Delete document"}
                        aria-label={isAr ? "حذف الوثيقة" : "Delete document"}
                      >
                        {deletingSourceId === doc.source_id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                      <FileText
                        size={20}
                        className="text-gray-400 flex-shrink-0"
                      />
                    </div>
                  </div>

                  <MinistryTag name={doc.source_name} />

                  {doc.excerpt && (
                    <p className="text-xs text-gray-600 line-clamp-2 italic border-t pt-2">
                      &quot;{doc.excerpt.substring(0, 100)}...&quot;
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 border-t pt-2 mt-auto text-xs">
                    <div>
                      <div className="text-gray-500">
                        {isAr ? "الأجزاء" : "Chunks"}
                      </div>
                      <div className="font-semibold">
                        {doc.total_chunks}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">
                        {isAr ? "اللغة" : "Lang"}
                      </div>
                      <div className="font-semibold">
                        {doc.language.toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">
                        {isAr ? "الإصدار" : "Ver"}
                      </div>
                      <div className="font-semibold">
                        v{doc.current_version}
                      </div>
                    </div>
                  </div>

                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700"
                        >
                          #{tag}
                        </span>
                      ))}
                      {doc.tags.length > 2 && (
                        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                          +{doc.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {!searching && filteredResults.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            {isAr
              ? `عرض ${filteredResults.length} من ${sources.length} وثيقة`
              : `Showing ${filteredResults.length} of ${sources.length} documents`}
          </div>
        )}
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
