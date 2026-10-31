import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus, Trash2, X, Clock, Zap, Percent, DollarSign,
  RefreshCw, Search, Ticket, AlertCircle, Calendar,
  Settings, Target, Box, Copy, Layout, UserCheck,
  Check, Tag, Info, ArrowLeft, ChevronRight
} from 'lucide-react';
import { discountsAPI, productsAPI, categoriesAPI } from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { StoreInlineSpinner } from '../../components/store/StoreInlineSpinner';
import toast from 'react-hot-toast';
import '../../styles/discounts-mobile.css';

/* ─────────────────────────────────────────────────────────────
   ESTILOS INLINE — sin depender de discounts.css para el layout
───────────────────────────────────────────────────────────── */
const S = {
  /* ── LIST VIEW ── */
  page: {
    padding: '2rem',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  /* ── HEADER OPTIMIZADO - IDENTIDAD lightcode ── */
  header: {
    position: 'relative',
    background: 'linear-gradient(135deg, rgba(17, 17, 17, 0.95) 0%, rgba(10, 10, 10, 0.98) 50%, rgba(5, 5, 5, 1) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-12) var(--space-8)',
    marginBottom: 'var(--space-8)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--space-6)',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    margin: 0,
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 'var(--text-5xl)',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #FFFFFF 0%, #EDEDED 50%, #D4D4D4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: 'var(--space-2)',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    textShadow: '0 2px 20px rgba(255, 255, 255, 0.1)',
  },
  headerSub: {
    margin: 0,
    fontSize: 'var(--text-lg)',
    color: 'var(--text-secondary)',
    fontFamily: "'Inter', sans-serif",
    lineHeight: 1.6,
    fontWeight: 500,
  },
  headerActions: {
    display: 'flex',
    gap: '0.65rem',
    flexShrink: 0,
  },
  quickBar: {
    background: 'var(--bg-card, #111118)',
    border: '1px solid var(--border, #1E1E2E)',
    borderRadius: '12px',
    padding: '0.85rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.25rem',
    flexWrap: 'wrap',
  },
  quickLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--accent, #7C3AED)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
    fontFamily: "'Inter', sans-serif",
  },
  quickForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    flexWrap: 'wrap',
  },
  quickInput: {
    background: 'var(--bg-dark, #09090F)',
    border: '1px solid var(--border, #1E1E2E)',
    borderRadius: '8px',
    padding: '0.5rem 0.85rem',
    color: 'var(--text-primary, #EDEDF5)',
    fontSize: '0.85rem',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    minWidth: '140px',
    flex: 1,
    transition: 'border-color 0.2s ease',
  },
  card: {
    background: 'var(--bg-card, #111118)',
    border: '1px solid var(--border, #1E1E2E)',
    borderRadius: '14px',
    overflow: 'hidden',
  },
  cardHead: {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border, #1E1E2E)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'var(--bg-dark, #09090F)',
    border: '1px solid var(--border, #1E1E2E)',
    borderRadius: '8px',
    padding: '0.5rem 0.85rem',
    flex: 1,
    maxWidth: '320px',
  },
  searchInput: {
    background: 'none',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary, #EDEDF5)',
    fontSize: '0.85rem',
    fontFamily: "'Inter', sans-serif",
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '0.75rem 1.25rem',
    textAlign: 'left',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-tertiary, #55556A)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontFamily: "'Inter', sans-serif",
    borderBottom: '1px solid var(--border, #1E1E2E)',
    background: 'rgba(0, 0, 0, 0.2)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '0.9rem 1.25rem',
    borderBottom: '1px solid var(--border, #1E1E2E)',
    verticalAlign: 'middle',
  },

  /* ── FORM VIEW ── */
  formPage: {
    /* Ocupa el espacio del content area, NO la pantalla completa */
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '1.75rem 2rem',
    boxSizing: 'border-box',
    gap: '1.25rem',
    overflow: 'auto',
  },
  formHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexShrink: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid var(--border, #334155)',
    background: 'var(--surface-2, #1e293b)',
    color: 'var(--text-primary, #f1f5f9)',
    cursor: 'pointer',
    flexShrink: 0,
  },

  /* ── DOS COLUMNAS: form-left + summary-right ── */
  formLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '1.5rem',
    flex: 1,
    minHeight: 0,
    alignItems: 'start',
  },

  /* ── COLUMNA IZQUIERDA ── */
  formLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    minWidth: 0,
  },
  tabBar: {
    display: 'flex',
    gap: '0.25rem',
    background: 'var(--surface-3, #0f172a)',
    borderRadius: '10px',
    padding: '0.3rem',
    width: 'fit-content',
  },
  tab: (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: active ? 600 : 400,
    background: active ? 'var(--surface-2, #1e293b)' : 'transparent',
    color: active ? 'var(--text-primary, #f1f5f9)' : 'var(--text-muted, #94a3b8)',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
    transition: 'all 0.15s',
  }),
  formCard: {
    background: 'var(--surface-2, #1e293b)',
    border: '1px solid var(--border, #334155)',
    borderRadius: '14px',
    padding: '1.5rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.1rem',
  },
  fullWidth: {
    gridColumn: '1 / -1',
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-muted, #94a3b8)',
    marginBottom: '0.4rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    background: 'var(--surface-3, #0f172a)',
    border: '1px solid var(--border, #334155)',
    borderRadius: '8px',
    padding: '0.6rem 0.9rem',
    color: 'var(--text-primary, #f1f5f9)',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  select: {
    width: '100%',
    background: 'var(--surface-3, #0f172a)',
    border: '1px solid var(--border, #334155)',
    borderRadius: '8px',
    padding: '0.6rem 0.9rem',
    color: 'var(--text-primary, #f1f5f9)',
    fontSize: '0.88rem',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  inputWithPrefix: {
    display: 'flex',
    alignItems: 'stretch',
    border: '1px solid var(--border, #334155)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  prefix: {
    background: 'var(--surface-3, #0f172a)',
    borderRight: '1px solid var(--border, #334155)',
    padding: '0 0.75rem',
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.85rem',
    color: 'var(--text-muted, #94a3b8)',
    fontWeight: 600,
  },
  prefixInput: {
    flex: 1,
    background: 'var(--surface-3, #0f172a)',
    border: 'none',
    padding: '0.6rem 0.9rem',
    color: 'var(--text-primary, #f1f5f9)',
    fontSize: '0.88rem',
    outline: 'none',
    width: '100%',
  },
  helpText: {
    margin: '0.3rem 0 0',
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94a3b8)',
  },

  /* ── SCOPE SELECTOR ── */
  scopeRow: {
    display: 'flex',
    gap: '0.65rem',
    marginBottom: '1.25rem',
  },
  scopeBtn: (active) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.85rem 0.5rem',
    borderRadius: '10px',
    border: `1px solid ${active ? 'var(--accent, #6366f1)' : 'var(--border, #334155)'}`,
    background: active ? 'rgba(99,102,241,0.1)' : 'var(--surface-3, #0f172a)',
    color: active ? 'var(--accent, #6366f1)' : 'var(--text-muted, #94a3b8)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
  }),
  scopeBtnTitle: {
    fontSize: '0.78rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  scopeBtnSub: {
    fontSize: '0.7rem',
    opacity: 0.7,
  },

  /* ── RESOURCE LIST ── */
  resourceSearch: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'var(--surface-3, #0f172a)',
    border: '1px solid var(--border, #334155)',
    borderRadius: '8px',
    padding: '0.5rem 0.85rem',
    marginBottom: '0.65rem',
  },
  resourceList: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.4rem',
    maxHeight: '240px',
    overflowY: 'auto',
    padding: '0.1rem',
  },
  resourceItem: (selected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.55rem 0.75rem',
    borderRadius: '8px',
    border: `1px solid ${selected ? 'var(--accent, #6366f1)' : 'var(--border, #334155)'}`,
    background: selected ? 'rgba(99,102,241,0.12)' : 'var(--surface-3, #0f172a)',
    cursor: 'pointer',
    transition: 'all 0.12s',
  }),
  resourceCheckbox: (selected) => ({
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    border: `1.5px solid ${selected ? 'var(--accent, #6366f1)' : 'var(--border, #334155)'}`,
    background: selected ? 'var(--accent, #6366f1)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.12s',
  }),
  resourceName: {
    fontSize: '0.8rem',
    color: 'var(--text-primary, #f1f5f9)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  /* ── SWITCHES ── */
  switchCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    background: 'var(--surface-3, #0f172a)',
    borderRadius: '10px',
    border: '1px solid var(--border, #334155)',
  },
  switchInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
  },
  switchTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-primary, #f1f5f9)',
  },
  switchSub: {
    fontSize: '0.75rem',
    color: 'var(--text-muted, #94a3b8)',
  },

  /* ── COLUMNA DERECHA: SUMMARY ── */
  summaryCol: {
    position: 'sticky',
    top: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  summaryCard: {
    background: 'var(--surface-2, #1e293b)',
    border: '1px solid var(--border, #334155)',
    borderRadius: '14px',
    overflow: 'hidden',
  },
  summaryHead: {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid var(--border, #334155)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: 'var(--text-muted, #94a3b8)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  couponPreview: {
    margin: '1.25rem',
    background: 'linear-gradient(135deg, var(--accent, #7C3AED), var(--primary, #00D4AA))',
    borderRadius: '12px',
    padding: '1.25rem',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  couponCode: {
    fontSize: '1.1rem',
    fontWeight: 800,
    fontFamily: "'JetBrains Mono', monospace",
    color: 'white',
    letterSpacing: '0.1em',
    opacity: 0.95,
  },
  couponValue: {
    fontSize: '2rem',
    fontWeight: 900,
    fontFamily: "'Space Grotesk', sans-serif",
    color: 'white',
    lineHeight: 1.1,
    marginTop: '0.25rem',
  },
  statsList: {
    padding: '0 1.25rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.82rem',
  },
  statLabel: { color: 'var(--text-muted, #94a3b8)' },
  statValue: { fontWeight: 600, color: 'var(--text-primary, #f1f5f9)' },
  calcBox: {
    margin: '0 1.25rem 1.25rem',
    background: 'var(--surface-3, #0f172a)',
    borderRadius: '10px',
    padding: '1rem',
  },
  calcTitle: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--text-muted, #94a3b8)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '0.75rem',
  },
  calcRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.83rem',
    marginBottom: '0.4rem',
  },
  calcDivider: {
    height: '1px',
    background: 'var(--border, #334155)',
    margin: '0.6rem 0',
  },
  calcTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-primary, #f1f5f9)',
  },

  /* ── FOOTER FORM ── */
  formFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.1rem 1.5rem',
    background: 'var(--surface-2, #1e293b)',
    border: '1px solid var(--border, #334155)',
    borderRadius: '14px',
    gap: '1rem',
    flexShrink: 0,
  },

  /* ── TABLA ROWS ── */
  couponCode2: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: '0.88rem',
    color: 'var(--accent, #7C3AED)',
    background: 'rgba(124, 58, 237, 0.12)',
    padding: '0.2rem 0.55rem',
    borderRadius: '6px',
    letterSpacing: '0.05em',
  },
  badge: (status) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.28rem 0.7rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    background: status === 'active' ? 'rgba(0, 212, 170, 0.12)' :
                status === 'scheduled' ? 'rgba(245,158,11,0.12)' :
                'rgba(136, 136, 170, 0.12)',
    color: status === 'active' ? 'var(--primary, #00D4AA)' :
           status === 'scheduled' ? '#f59e0b' :
           'var(--text-secondary, #8888AA)',
  }),
  dot: (status) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: status === 'active' ? 'var(--primary, #00D4AA)' :
                status === 'scheduled' ? '#f59e0b' : 
                'var(--text-secondary, #8888AA)',
  }),
  actionBtn: (danger) => ({
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: '1px solid var(--border, #334155)',
    background: danger ? 'rgba(239,68,68,0.08)' : 'var(--surface-3, #0f172a)',
    color: danger ? '#ef4444' : 'var(--text-muted, #94a3b8)',
    cursor: 'pointer',
    transition: 'all 0.12s',
  }),
  statusToggle: (active) => ({
    padding: '0.3rem 0.75rem',
    borderRadius: '999px',
    border: `1px solid ${active ? 'var(--primary, #00D4AA)' : 'var(--border, #1E1E2E)'}`,
    background: active ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
    color: active ? 'var(--primary, #00D4AA)' : 'var(--text-secondary, #8888AA)',
    fontSize: '0.75rem',
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }),
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    color: 'var(--text-muted, #94a3b8)',
  },

  /* ── BOTONES CON GLOW ── */
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.6rem 1.1rem',
    borderRadius: 'var(--radius-md, 8px)',
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    cursor: 'pointer',
    transition: 'all var(--transition-base, 0.2s ease)',
    whiteSpace: 'nowrap',
    position: 'relative',
  },
  btnPrimary: {
    background: 'var(--primary, #00D4AA)',
    color: '#FFFFFF',
    fontWeight: 600,
    boxShadow: '0 4px 20px rgba(0, 212, 170, 0.3)',
  },
  btnSecondary: {
    background: 'var(--bg-hover, rgba(255, 255, 255, 0.03))',
    color: 'var(--text-primary, #EDEDF5)',
    border: '2px solid var(--border-hover, #2A2A3E)',
  },
  btnSm: {
    padding: 'var(--space-2, 8px) var(--space-3, 12px)',
    fontSize: 'var(--text-sm, 0.875rem)',
    borderRadius: 'var(--radius-md, 8px)',
  },

  /* MODAL */
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  modal: {
    background: 'var(--surface-2, #1e293b)',
    border: '1px solid var(--border, #334155)',
    borderRadius: '16px',
    padding: '1.75rem',
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.1rem',
  },

  progressBar: {
    height: '4px',
    background: 'var(--border, #334155)',
    borderRadius: '999px',
    overflow: 'hidden',
    marginTop: '0.35rem',
  },
  progressFill: (pct, danger) => ({
    height: '100%',
    width: `${Math.min(100, pct)}%`,
    background: danger ? '#ef4444' : 'var(--accent, #6366f1)',
    borderRadius: '999px',
    transition: 'width 0.3s',
  }),
};

/* ════════════════════════════════════════════════════════════ */
export default function Discounts() {
  const { storeSlug } = useParams();
  const { activeStore } = useStore();

  const [discounts, setDiscounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [productSearch, setProductSearch] = useState('');
  const [quickCreate, setQuickCreate] = useState({ code: '', value: '' });
  const [viewMode, setViewMode] = useState('list');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, code }

  const initialForm = {
    name: '', code: '', code_type: 'GENERAL', discount_type: 'PERCENTAGE',
    value: '', scope: 'ALL_STORE', applicable_products: [], applicable_categories: [],
    min_purchase_amount: 0, min_items_count: 0, only_first_purchase: false,
    max_uses_global: '', max_uses_per_user: 1, is_combinable: false,
    start_date: new Date().toISOString().slice(0, 16), end_date: '', is_active: true,
  };

  const [formData, setFormData] = useState(initialForm);
  const [bulkData, setBulkData] = useState({ count: 10, name: 'Campaña', discount_type: 'PERCENTAGE', value: 20 });

  useEffect(() => {
    if (activeStore) { loadDiscounts(); loadResources(); }
  }, [activeStore]);

  const loadDiscounts = async () => {
    try { 
      setLoading(true); 
      const r = await discountsAPI.list(activeStore.id); 
      
      // Asegurar que siempre sea un array
      const discountsData = Array.isArray(r.data) ? r.data : (r.data?.results || []);
      
      setDiscounts(discountsData); 
    }
    catch (err) { 
      console.error('Error al cargar descuentos:', err);
      console.error('Error response:', err.response?.data);
      toast.error('Error al cargar descuentos'); 
      setDiscounts([]); 
    }
    finally { setLoading(false); }
  };

  const loadResources = async () => {
    try {
      const [pr, cr] = await Promise.all([productsAPI.listByStore(activeStore.id), categoriesAPI.list(activeStore.id)]);
      setProducts(pr.data.results || pr.data);
      setCategories(cr.data.results || cr.data);
    } catch { console.error('Error loading resources'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    setSubmitting(true);
    try {
      const data = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        code_type: formData.code_type,
        discount_type: formData.discount_type,
        value: parseFloat(formData.value) || 0,
        scope: formData.scope,
        applicable_products: formData.applicable_products || [],
        applicable_categories: formData.applicable_categories || [],
        min_purchase_amount: parseFloat(formData.min_purchase_amount) || 0,
        min_items_count: parseInt(formData.min_items_count) || 0,
        only_first_purchase: formData.only_first_purchase,
        max_uses_global: formData.max_uses_global ? parseInt(formData.max_uses_global) : null,
        max_uses_per_user: parseInt(formData.max_uses_per_user) || 1,
        is_combinable: formData.is_combinable,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        is_active: formData.is_active,
        store: activeStore.id
      };
      
      if (editingDiscount) { 
        await discountsAPI.update(editingDiscount.id, data); 
        toast.success('Descuento actualizado'); 
      }
      else { 
        await discountsAPI.create(data); 
        toast.success('Descuento creado'); 
      }
      resetForm(); 
      setTimeout(loadDiscounts, 300);
    } catch (err) { 
      console.error('Error al guardar descuento:', err.response?.data);
      toast.error(err.response?.data?.error || err.response?.data?.code?.[0] || 'Error al guardar'); 
    }
    finally { setSubmitting(false); }
  };

  const handleQuickCreate = async (e) => {
    e.preventDefault(); 
    if (!quickCreate.code || !quickCreate.value) {
      toast.error('Completa todos los campos');
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        name: `Rápido ${quickCreate.code}`,
        code: quickCreate.code.toUpperCase(),
        code_type: 'GENERAL',
        discount_type: 'PERCENTAGE',
        value: parseFloat(quickCreate.value),
        scope: 'ALL_STORE',
        applicable_products: [],
        applicable_categories: [],
        min_purchase_amount: 0,
        min_items_count: 0,
        only_first_purchase: false,
        max_uses_global: null,
        max_uses_per_user: 1,
        is_combinable: false,
        start_date: new Date().toISOString(),
        end_date: null,
        is_active: true,
        store: activeStore.id
      };
      await discountsAPI.create(data);
      toast.success('¡Descuento rápido creado!'); 
      setQuickCreate({ code: '', value: '' }); 
      setTimeout(loadDiscounts, 300);
    } catch (err) { 
      console.error('Error al crear descuento rápido:', err.response?.data);
      toast.error(err.response?.data?.error || 'Error al crear'); 
    }
    finally { setSubmitting(false); }
  };

  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    try { 
      const data = {
        count: parseInt(bulkData.count),
        name: bulkData.name || 'Campaña masiva',
        discount_type: bulkData.discount_type || 'PERCENTAGE',
        value: parseFloat(bulkData.value),
        store: activeStore.id
      };
      await discountsAPI.bulkGenerate(data); 
      toast.success(`${bulkData.count} códigos generados`); 
      setIsBulkModalOpen(false); 
      setTimeout(loadDiscounts, 300);
    }
    catch (err) { 
      console.error('Error al generar códigos:', err.response?.data);
      toast.error(err.response?.data?.error || 'Error al generar'); 
    }
  };

  const handleEdit = (d) => {
    setEditingDiscount(d);
    setFormData({ ...d, start_date: d.start_date?.slice(0, 16) || new Date().toISOString().slice(0, 16), end_date: d.end_date?.slice(0, 16) || '', applicable_products: d.applicable_products || [], applicable_categories: d.applicable_categories || [] });
    setActiveTab('general'); setViewMode('form');
  };

  const resetForm = () => { setFormData(initialForm); setActiveTab('general'); setEditingDiscount(null); setViewMode('list'); };

  const toggleStatus = async (d) => { try { await discountsAPI.update(d.id, { is_active: !d.is_active }); loadDiscounts(); } catch { toast.error('Error'); } };

  const handleDelete = async (id) => {
    try { 
      await discountsAPI.delete(id); 
      toast.success('Eliminado'); 
      setDeleteConfirm(null);
      setTimeout(loadDiscounts, 300);
    } catch { 
      toast.error('Error al eliminar'); 
    }
  };

  const toggleSel = (id, field) => setFormData(prev => ({ ...prev, [field]: prev[field].includes(id) ? prev[field].filter(i => i !== id) : [...prev[field], id] }));

  const getSummaryImpact = () => {
    const base = 20; const v = parseFloat(formData.value) || 0;
    return formData.discount_type === 'PERCENTAGE' ? base - (base * v / 100) : Math.max(0, base - v);
  };

  const filteredDiscounts = discounts.filter(d =>
    d.code.toLowerCase().includes(searchTerm.toLowerCase()) || d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  if (loading && !discounts.length) return <StoreInlineSpinner label="Cargando descuentos..." />;

  /* ═══════════════════════ FORM VIEW ═══════════════════════ */
  if (viewMode === 'form') {
    return (
      <div style={S.formPage}>
        {/* Encabezado */}
        <div style={S.formHeader}>
          <button style={S.backBtn} onClick={resetForm}><ArrowLeft size={18} /></button>
          <div>
            <h2 style={{ ...S.headerTitle, fontSize: '1.3rem' }}>{editingDiscount ? 'Editar Descuento' : 'Nuevo Descuento'}</h2>
            <p style={S.headerSub}>Configura todos los parámetros de tu campaña promocional.</p>
          </div>
        </div>

        {/* Layout dos columnas */}
        <div style={S.formLayout}>

          {/* ── IZQUIERDA ── */}
          <div style={S.formLeft}>
            {/* Tabs */}
            <div style={S.tabBar}>
              {[
                { key: 'general', label: 'General', icon: <Settings size={14} /> },
                { key: 'rules', label: 'Aplicación', icon: <Target size={14} /> },
                { key: 'limits', label: 'Restricciones', icon: <AlertCircle size={14} /> },
              ].map(t => (
                <button key={t.key} style={S.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            <form id="discount-form" onSubmit={handleSubmit}>
              {/* ─ TAB GENERAL ─ */}
              {activeTab === 'general' && (
                <div style={S.formCard}>
                  <div style={S.formGrid}>
                    <div style={S.fullWidth}>
                      <label style={S.label}>Nombre de la campaña</label>
                      <input style={S.input} type="text" placeholder="Ej: Oferta de Lanzamiento 2026" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                      <p style={S.helpText}>Solo para uso interno — ayuda a identificar este descuento.</p>
                    </div>

                    <div>
                      <label style={S.label}>Código del cupón</label>
                      <input style={{ ...S.input, fontFamily: 'monospace', letterSpacing: '0.08em', fontWeight: 700 }} type="text" placeholder="DESCUENTO20" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} required disabled={!!editingDiscount} />
                    </div>

                    <div>
                      <label style={S.label}>Tipo de código</label>
                      <select style={S.select} value={formData.code_type} onChange={e => setFormData({ ...formData, code_type: e.target.value })}>
                        <option value="GENERAL">Público (muchos usos)</option>
                        <option value="PERSONAL">Único (1 uso)</option>
                      </select>
                    </div>

                    <div>
                      <label style={S.label}>Tipo de beneficio</label>
                      <select style={S.select} value={formData.discount_type} onChange={e => setFormData({ ...formData, discount_type: e.target.value })}>
                        <option value="PERCENTAGE">Porcentaje (%)</option>
                        <option value="FIXED_AMOUNT">Monto Fijo ($)</option>
                      </select>
                    </div>

                    <div>
                      <label style={S.label}>Valor del descuento</label>
                      <div style={S.inputWithPrefix}>
                        <span style={S.prefix}>{formData.discount_type === 'PERCENTAGE' ? '%' : '$'}</span>
                        <input style={S.prefixInput} type="number" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} required min="0" placeholder="0" />
                      </div>
                    </div>

                    <div>
                      <label style={S.label}>Válido desde</label>
                      <input style={S.input} type="datetime-local" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
                    </div>

                    <div>
                      <label style={S.label}>Válido hasta <span style={{ opacity: 0.6 }}>(opcional)</span></label>
                      <input style={S.input} type="datetime-local" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {/* ─ TAB APLICACIÓN ─ */}
              {activeTab === 'rules' && (
                <div style={S.formCard}>
                  <label style={{ ...S.label, marginBottom: '0.75rem' }}>¿A qué aplica este descuento?</label>

                  {/* Selector de scope */}
                  <div style={S.scopeRow}>
                    {[
                      { value: 'ALL_STORE', icon: <Layout size={20} />, title: 'Toda la tienda', sub: 'Cualquier producto' },
                      { value: 'SPECIFIC_PRODUCTS', icon: <Box size={20} />, title: 'Productos', sub: 'Solo seleccionados' },
                      { value: 'SPECIFIC_CATEGORIES', icon: <Tag size={20} />, title: 'Categorías', sub: 'Grupos completos' },
                    ].map(s => (
                      <button key={s.value} type="button" style={S.scopeBtn(formData.scope === s.value)} onClick={() => setFormData({ ...formData, scope: s.value })}>
                        {s.icon}
                        <span style={S.scopeBtnTitle}>{s.title}</span>
                        <span style={S.scopeBtnSub}>{s.sub}</span>
                      </button>
                    ))}
                  </div>

                  {/* Contenido del scope — SIEMPRE ABAJO, no al lado */}
                  {formData.scope === 'ALL_STORE' && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted, #94a3b8)', background: 'var(--surface-3, #0f172a)', borderRadius: '10px' }}>
                      <Layout size={36} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>El descuento aplica automáticamente a todos los productos de tu tienda.</p>
                    </div>
                  )}

                  {formData.scope === 'SPECIFIC_PRODUCTS' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <label style={{ ...S.label, margin: 0 }}>Productos seleccionados ({formData.applicable_products.length})</label>
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent, #6366f1)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => setFormData(p => ({ ...p, applicable_products: products.map(x => x.id) }))}>
                          Seleccionar todos
                        </button>
                      </div>
                      <div style={S.resourceSearch}>
                        <Search size={14} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
                        <input style={{ ...S.searchInput, fontSize: '0.82rem' }} type="text" placeholder="Buscar producto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                      </div>
                      <div style={S.resourceList}>
                        {filteredProducts.map(p => {
                          const sel = formData.applicable_products.includes(p.id);
                          return (
                            <div key={p.id} style={S.resourceItem(sel)} onClick={() => toggleSel(p.id, 'applicable_products')}>
                              <div style={S.resourceCheckbox(sel)}>{sel && <Check size={10} color="white" />}</div>
                              <span style={S.resourceName}>{p.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {formData.scope === 'SPECIFIC_CATEGORIES' && (
                    <div>
                      <label style={{ ...S.label, marginBottom: '0.65rem' }}>Categorías seleccionadas ({formData.applicable_categories.length})</label>
                      <div style={S.resourceList}>
                        {categories.map(c => {
                          const sel = formData.applicable_categories.includes(c.id);
                          return (
                            <div key={c.id} style={S.resourceItem(sel)} onClick={() => toggleSel(c.id, 'applicable_categories')}>
                              <div style={S.resourceCheckbox(sel)}>{sel && <Check size={10} color="white" />}</div>
                              <span style={S.resourceName}>{c.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─ TAB RESTRICCIONES ─ */}
              {activeTab === 'limits' && (
                <div style={S.formCard}>
                  <div style={S.formGrid}>
                    <div>
                      <label style={S.label}>Compra mínima</label>
                      <div style={S.inputWithPrefix}>
                        <span style={S.prefix}>$</span>
                        <input style={S.prefixInput} type="number" value={formData.min_purchase_amount} onChange={e => setFormData({ ...formData, min_purchase_amount: e.target.value })} min="0" />
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>Mínimo de items</label>
                      <input style={S.input} type="number" value={formData.min_items_count} onChange={e => setFormData({ ...formData, min_items_count: e.target.value })} min="0" />
                    </div>
                    <div>
                      <label style={S.label}>Límite global</label>
                      <input style={S.input} type="number" placeholder="Sin límite" value={formData.max_uses_global} onChange={e => setFormData({ ...formData, max_uses_global: e.target.value })} min="1" />
                    </div>
                    <div>
                      <label style={S.label}>Usos por usuario</label>
                      <input style={S.input} type="number" value={formData.max_uses_per_user} onChange={e => setFormData({ ...formData, max_uses_per_user: e.target.value })} min="1" />
                    </div>

                    <div style={S.fullWidth}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[
                          { key: 'only_first_purchase', title: 'Solo primera compra', sub: 'Exclusivo para nuevos clientes' },
                          { key: 'is_combinable', title: 'Combinable', sub: 'Se puede usar con otros cupones' },
                          { key: 'is_active', title: 'Activar ahora', sub: 'Visible al público inmediatamente' },
                        ].map(sw => (
                          <div key={sw.key} style={S.switchCard}>
                            <div style={S.switchInfo}>
                              <span style={S.switchTitle}>{sw.title}</span>
                              <span style={S.switchSub}>{sw.sub}</span>
                            </div>
                            <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                              <input type="checkbox" checked={formData[sw.key]} onChange={e => setFormData({ ...formData, [sw.key]: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
                              <span style={{
                                display: 'block', width: '40px', height: '22px', borderRadius: '999px',
                                background: formData[sw.key] ? 'var(--accent, #6366f1)' : 'var(--border, #334155)',
                                transition: 'background 0.2s', position: 'relative',
                              }}>
                                <span style={{
                                  position: 'absolute', top: '3px',
                                  left: formData[sw.key] ? '21px' : '3px',
                                  width: '16px', height: '16px', borderRadius: '50%',
                                  background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                              </span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>

            <div style={S.formFooter}>
              <button style={{ ...S.btn, ...S.btnSecondary }} onClick={resetForm} disabled={submitting}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--accent, #7C3AED) 12%, var(--bg-hover))';
                    e.currentTarget.style.borderColor = 'var(--accent, #7C3AED)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = 'var(--bg-hover, rgba(255, 255, 255, 0.03))';
                    e.currentTarget.style.borderColor = 'var(--border-hover, #2A2A3E)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >Cancelar</button>
              <button type="submit" form="discount-form" style={{ ...S.btn, ...S.btnPrimary }} disabled={submitting}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = 'var(--primary-hover, #00B894)';
                    e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 212, 170, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = 'var(--primary, #00D4AA)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 212, 170, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                {submitting ? <><RefreshCw size={15} className="spin" /> Guardando...</> : <><Check size={15} /> {editingDiscount ? 'Actualizar descuento' : 'Guardar descuento'}</>}
              </button>
            </div>
          </div>

          {/* ── DERECHA: SUMMARY ── */}
          <div style={S.summaryCol}>
            <div style={S.summaryCard}>
              <div style={S.summaryHead}><Ticket size={14} style={{ color: 'var(--accent, #6366f1)' }} /> Vista previa del cupón</div>

              <div style={S.couponPreview}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }} />
                <div style={S.couponCode}>{formData.code || 'CÓDIGO'}</div>
                <div style={S.couponValue}>{formData.value || '0'}{formData.discount_type === 'PERCENTAGE' ? '%' : '$'} OFF</div>
              </div>

              <div style={S.statsList}>
                <div style={S.statRow}>
                  <span style={S.statLabel}>Alcance</span>
                  <span style={S.statValue}>{formData.scope === 'ALL_STORE' ? 'Toda la tienda' : formData.scope === 'SPECIFIC_PRODUCTS' ? `${formData.applicable_products.length} productos` : `${formData.applicable_categories.length} categorías`}</span>
                </div>
                <div style={S.statRow}>
                  <span style={S.statLabel}>Mínimo de compra</span>
                  <span style={S.statValue}>${formData.min_purchase_amount || 0}</span>
                </div>
                <div style={S.statRow}>
                  <span style={S.statLabel}>Uso por cliente</span>
                  <span style={S.statValue}>{formData.max_uses_per_user}x</span>
                </div>
                <div style={S.statRow}>
                  <span style={S.statLabel}>Estado</span>
                  <span style={{ ...S.statValue, color: formData.is_active ? '#10b981' : '#94a3b8' }}>{formData.is_active ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>

              <div style={S.calcBox}>
                <div style={S.calcTitle}>Simulación de precio</div>
                <div style={S.calcRow}><span style={{ color: 'var(--text-muted)' }}>Precio base</span><span>$20.00</span></div>
                <div style={{ ...S.calcRow, color: '#10b981' }}><span>Descuento</span><span>-${(20 - getSummaryImpact()).toFixed(2)}</span></div>
                <div style={S.calcDivider} />
                <div style={S.calcTotal}><span>Precio final</span><span>${getSummaryImpact().toFixed(2)}</span></div>
              </div>
            </div>

            {formData.end_date && (
              <div style={{ ...S.summaryCard, padding: '0.9rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: '#f59e0b' }}>
                <Calendar size={14} />
                <span>Expira el <strong>{new Date(formData.end_date).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════ LIST VIEW ═══════════════════════ */
  return (
    <div style={S.page}>
      {/* Header con gradiente */}
      <div style={S.header}>
        <div style={S.headerContent}>
          <div style={S.headerLeft}>
            <h1 style={S.headerTitle}>Descuentos</h1>
            <p style={S.headerSub}>Gestiona tus campañas y códigos promocionales</p>
          </div>
          <div style={S.headerActions}>
            <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setIsBulkModalOpen(true)}>
              <Zap size={15} /> En masa
            </button>
            <button 
              style={{ ...S.btn, ...S.btnPrimary }} 
              onClick={() => { setEditingDiscount(null); setFormData(initialForm); setActiveTab('general'); setViewMode('form'); }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-hover, #00B894)';
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 212, 170, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--primary, #00D4AA)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 212, 170, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={15} /> Nuevo descuento
            </button>
          </div>
        </div>
      </div>

      {/* Quick Create */}
      <div style={S.quickBar}>
        <div style={S.quickLabel}><Zap size={13} /> Creación Rápida</div>
        <form onSubmit={handleQuickCreate} style={S.quickForm}>
          <input style={{ ...S.quickInput }} type="text" placeholder="CÓDIGO (Ej: FLASH50)" value={quickCreate.code} onChange={e => setQuickCreate({ ...quickCreate, code: e.target.value.toUpperCase() })} required />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-3, #0f172a)', border: '1px solid var(--border, #334155)', borderRadius: '8px', padding: '0.5rem 0.85rem' }}>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', fontWeight: 600 }}>%</span>
            <input style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary, #f1f5f9)', fontSize: '0.85rem', width: '60px' }} type="number" placeholder="Valor" value={quickCreate.value} onChange={e => setQuickCreate({ ...quickCreate, value: e.target.value })} required />
          </div>
          <button type="submit" style={{ ...S.btn, ...S.btnSm, ...S.btnPrimary }} disabled={submitting}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = 'var(--primary-hover, #00B894)';
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 212, 170, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.background = 'var(--primary, #00D4AA)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 212, 170, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {submitting ? '...' : 'Crear'}
          </button>
        </form>
      </div>

      {/* Tabla */}
      <div style={S.card}>
        <div style={S.cardHead}>
          <div style={S.searchBox}>
            <Search size={15} style={{ color: 'var(--text-muted, #94a3b8)', flexShrink: 0 }} />
            <input style={S.searchInput} type="text" placeholder="Buscar por código o nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
              {discounts.filter(d => d.is_active).length} activos
            </div>
            <span>{discounts.length} total</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                {['Cupón', 'Estado', 'Valor', 'Alcance', 'Activo', ''].map((h, i) => (
                  <th key={i} style={{ ...S.th, textAlign: i === 5 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDiscounts.length > 0 ? filteredDiscounts.map(d => {
                const status = d.status || 'active'; // Fallback si no viene status
                return (
                  <tr key={d.id} style={{ transition: 'background 0.12s' }}>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                        <span style={S.couponCode2}>{d.code}</span>
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #8888AA)', cursor: 'pointer', padding: '2px', display: 'flex' }} onClick={() => { navigator.clipboard.writeText(d.code); toast.success('Código copiado'); }}>
                          <Copy size={12} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8888AA)' }}>{d.name}</div>
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(status)}>
                        <span style={S.dot(status)} />
                        {status === 'active' ? 'Activo' : status === 'scheduled' ? 'Programado' : status === 'expired' ? 'Expirado' : status === 'inactive' ? 'Inactivo' : 'Límite'}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, fontSize: '0.9rem' }}>
                      {d.discount_type === 'PERCENTAGE' ? `${Number(d.value).toFixed(0)}%` : `$${Number(d.value).toFixed(2)}`}
                    </td>
                    <td style={{ ...S.td, fontSize: '0.82rem', color: 'var(--text-secondary, #8888AA)' }}>
                      {d.scope === 'ALL_STORE' ? '🌐 Tienda completa' : d.scope === 'SPECIFIC_PRODUCTS' ? `📦 ${d.applicable_products?.length || 0} productos` : `🏷️ ${d.applicable_categories?.length || 0} categorías`}
                    </td>
                    <td style={S.td}>
                      <button style={S.statusToggle(d.is_active)} onClick={() => toggleStatus(d)}>
                        {d.is_active ? 'Activo' : 'Pausado'}
                      </button>
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                        <button style={S.actionBtn(false)} onClick={() => handleEdit(d)} title="Editar"><Settings size={13} /></button>
                        <button style={S.actionBtn(true)} onClick={() => setDeleteConfirm({ id: d.id, code: d.code })} title="Eliminar"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" style={S.td}>
                  <div style={S.emptyState}>
                    <Ticket size={36} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>No se encontraron descuentos</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal masivo */}
      {isBulkModalOpen && (
        <div style={S.overlay} onClick={() => setIsBulkModalOpen(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #EDEDF5)', fontFamily: "'Space Grotesk', sans-serif" }}>Generación Masiva</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #8888AA)', cursor: 'pointer' }} onClick={() => setIsBulkModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleBulkGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={S.label}>Cantidad (máx. 100)</label>
                <input style={S.input} type="number" max="100" value={bulkData.count} onChange={e => setBulkData({ ...bulkData, count: e.target.value })} required />
              </div>
              <div>
                <label style={S.label}>Valor (%)</label>
                <input style={S.input} type="number" value={bulkData.value} onChange={e => setBulkData({ ...bulkData, value: e.target.value })} required />
              </div>
              <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
                <button type="button" style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setIsBulkModalOpen(false)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'color-mix(in srgb, var(--accent, #7C3AED) 12%, var(--bg-hover))';
                    e.currentTarget.style.borderColor = 'var(--accent, #7C3AED)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover, rgba(255, 255, 255, 0.03))';
                    e.currentTarget.style.borderColor = 'var(--border-hover, #2A2A3E)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >Cancelar</button>
                <button type="submit" style={{ ...S.btn, ...S.btnPrimary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary-hover, #00B894)';
                    e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 212, 170, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--primary, #00D4AA)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 212, 170, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >Generar ahora</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteConfirm && (
        <div style={S.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={{ ...S.modal, maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: 'var(--radius-lg, 12px)', 
                background: 'rgba(185, 28, 28, 0.12)', 
                border: '1px solid rgba(185, 28, 28, 0.25)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertCircle size={24} color="var(--destructive, #B91C1C)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #EDEDF5)', fontFamily: "'Space Grotesk', sans-serif" }}>
                  ¿Eliminar descuento?
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary, #8888AA)', lineHeight: 1.5 }}>
                  Estás a punto de eliminar el cupón <strong style={{ color: 'var(--text-primary, #EDEDF5)', fontFamily: "'JetBrains Mono', monospace" }}>{deleteConfirm.code}</strong>. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end' }}>
              <button 
                style={{ ...S.btn, ...S.btnSecondary }} 
                onClick={() => setDeleteConfirm(null)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent, #7C3AED) 12%, var(--bg-hover))';
                  e.currentTarget.style.borderColor = 'var(--accent, #7C3AED)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover, rgba(255, 255, 255, 0.03))';
                  e.currentTarget.style.borderColor = 'var(--border-hover, #2A2A3E)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Cancelar
              </button>
              <button 
                style={{ 
                  ...S.btn, 
                  background: 'var(--destructive, #B91C1C)',
                  color: '#FECACA',
                  border: '1px solid rgba(185, 28, 28, 0.5)',
                  boxShadow: '0 4px 12px rgba(185, 28, 28, 0.3)'
                }}
                onClick={() => handleDelete(deleteConfirm.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--destructive-hover, #991B1B)';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(185, 28, 28, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--destructive, #B91C1C)';
                  e.currentTarget.style.color = '#FECACA';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(185, 28, 28, 0.3)';
                }}
              >
                <Trash2 size={15} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}