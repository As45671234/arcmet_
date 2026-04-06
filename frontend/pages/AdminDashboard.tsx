
import React, { useEffect, useState } from 'react';
import { Category, HomepageImages, SiteSettings } from '../types';
import { getAdminToken, fetchAdminCatalog, adminImportExcel, adminPatchProduct, adminDeleteProduct, adminCreateProduct, fetchCatalog, adminFetchOrders, adminFetchOrder, adminPatchOrder, adminDeleteOrder, adminExportOrder, adminFetchLeads, adminFetchLead, adminPatchLead, adminDeleteLead, adminUploadProductImage, adminPatchCategory, adminPurgeAll, adminGetSiteSettings, adminSaveSiteSettings, adminUploadImage } from '../services/api';
import { IMPORT_SUPPLIERS } from '../constants';
import { DEFAULT_HOMEPAGE_IMAGES } from '../homepageDefaults';
import { normalizeAssetUrl } from '../utils/assetUrl';

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  phone: '+7 775 702 92 98',
  email: 'ceo@arcmet.kz',
  address: 'Талапкерская 26а, офис 202',
  kaspiEnabled: true,
  kaspiUrl: 'https://kaspi.kz/shop/info/merchant/17410012/reviews/?productCode=136545715&masterSku=136545715&merchantSku=424870474&tabId=PRODUCT',
  halykEnabled: true,
  halykUrl: 'https://halykbank.kz/',
  heroSlides: [
    {
      title: 'Теплоизоляционные системы',
      subtitle: 'ПРИОРИТЕТНОГО УРОВНЯ',
      desc: 'Профессиональные решения для объектов любой сложности. Гарантия качества от ведущих производителей.',
      img: 'https://hidropro.ru/upload/dev2fun.imagecompress/webp/img/2-kak-vyglyadet-gidroizolyaciya-fundamenta.webp',
    },
    {
      title: 'Инновационная гидроизоляция',
      subtitle: 'НАДЕЖНОСТЬ И ДОЛГОВЕЧНОСТЬ',
      desc: 'Полимерные мембраны нового поколения. Идеальная защита от влаги на 50+ лет.',
      img: 'https://ir.ozone.ru/s3/multimedia-o/6775911780.jpg',
    },
  ],
  aboutSlides: [
    {
      title: 'ARCMET — комплексные поставки',
      text: 'Мы помогаем быстро укомплектовать объект современными строительными материалами: от гидроизоляции до фасадных решений.',
      imageUrl: '/about/postavka.jpg',
      bullets: ['Прямые поставки от производителей', 'Стабильные складские позиции', 'Поддержка на каждом этапе'],
    },
    {
      title: 'Консультации и подбор решений',
      text: 'Подбираем материалы под задачу, бюджет и сроки. Даем технические рекомендации и помогаем избежать ошибок на объекте.',
      imageUrl: '/about/consultation.jpg',
      bullets: ['Анализ проекта', 'Подбор аналогов', 'Экономия времени и бюджета'],
    },
    {
      title: 'Контроль качества и логистика',
      text: 'Отгружаем только проверенную продукцию и выстраиваем удобную доставку по городу и регионам.',
      imageUrl: '/about/control.jpg',
      bullets: ['Проверка партий', 'Гибкие условия доставки', 'Прозрачные документы'],
    },
    {
      title: 'Партнерство на годы',
      text: 'Строим долгосрочные отношения с клиентами и подрядчиками, чтобы проекты двигались без простоев.',
      imageUrl: '/about/partner.jpg',
      bullets: ['Личный менеджер', 'Оперативные ответы', 'Поддержка сложных проектов'],
    },
  ],
  homepageImages: DEFAULT_HOMEPAGE_IMAGES,
};

const mergeHomepageImages = (raw?: Partial<HomepageImages> | null): HomepageImages => {
  const src = raw || {};
  const productSlideOverrides = new Map(
    (Array.isArray(src.productSlides) ? src.productSlides : [])
      .map((item) => [String(item?.id || '').trim(), String(item?.image || '')] as const)
      .filter((entry) => Boolean(entry[0]))
  );

  const partnerLogos = Array.isArray(src.partnerLogos) ? src.partnerLogos : [];

  return {
    headerLogo: String(src.headerLogo || DEFAULT_HOMEPAGE_IMAGES.headerLogo || ''),
    footerLogo: String(src.footerLogo || DEFAULT_HOMEPAGE_IMAGES.footerLogo || ''),
    partnersBackground: String(src.partnersBackground || DEFAULT_HOMEPAGE_IMAGES.partnersBackground || ''),
    productSlides: DEFAULT_HOMEPAGE_IMAGES.productSlides.map((item) => ({
      id: item.id,
      image: String(productSlideOverrides.get(item.id) || item.image || ''),
    })),
    partnerLogos: DEFAULT_HOMEPAGE_IMAGES.partnerLogos.map((item, index) => String(partnerLogos[index] || item || '')),
  };
};

const mergeSiteSettings = (raw?: Partial<SiteSettings> | null): SiteSettings => {
  const src = raw || {};
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...src,
    heroSlides: Array.isArray(src.heroSlides) && src.heroSlides.length > 0 ? src.heroSlides : DEFAULT_SITE_SETTINGS.heroSlides,
    aboutSlides: Array.isArray(src.aboutSlides) && src.aboutSlides.length > 0 ? src.aboutSlides : DEFAULT_SITE_SETTINGS.aboutSlides,
    homepageImages: mergeHomepageImages(src.homepageImages),
  };
};

interface AdminDashboardProps {
  categories: Category[];
  setCategories: (cats: Category[]) => void;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ setCategories, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'import' | 'orders' | 'leads' | 'categories' | 'constructor'>('inventory');
  const [isImporting, setIsImporting] = useState(false);
  const [isPurgingAll, setIsPurgingAll] = useState(false);
  const [selectedImportSupplier, setSelectedImportSupplier] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [invPage, setInvPage] = useState(1);
  const INV_PAGE_SIZE = 30;
  const [adminCategories, setAdminCategories] = useState<Category[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState<string>('');
  const [addForm, setAddForm] = useState({
    category_title: '',
    name: '',
    brandOrGroup: '',
    unit: 'шт',
    sku: '',
    image: '',
    images: ['', '', ''],
    description: '',
    prices: {
      retail: '',
    },
    attrsText: '',
    inStock: true,
  });

  const [editForm, setEditForm] = useState({
    category_title: '',
    name: '',
    brandOrGroup: '',
    unit: 'шт',
    sku: '',
    image: '',
    images: ['', '', ''],
    description: '',
    prices: {
      retail: '',
    },
    attrsText: '',
    inStock: true,
  });
  const token = getAdminToken();
  const [addImageUploading, setAddImageUploading] = useState(false);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [categoryImageUploading, setCategoryImageUploading] = useState<Record<string, boolean>>({});
  const [categoryImageSaving, setCategoryImageSaving] = useState<Record<string, boolean>>({});
  const [categoryImageDrafts, setCategoryImageDrafts] = useState<Record<string, string>>({});
  const [constructorLoading, setConstructorLoading] = useState(false);
  const [constructorSaving, setConstructorSaving] = useState(false);
  const [siteForm, setSiteForm] = useState<SiteSettings>(mergeSiteSettings(DEFAULT_SITE_SETTINGS));

  // Orders
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit, setOrdersLimit] = useState(25);
  const [ordersStatus, setOrdersStatus] = useState<string>('');
  const [ordersSortBy, setOrdersSortBy] = useState<'date' | 'status'>('date');
  const [ordersSortDir, setOrdersSortDir] = useState<'asc' | 'desc'>('desc');

  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string>('');
  const [importResult, setImportResult] = useState<{ type: 'success' | 'error'; title: string; details: string } | null>(null);

  // Leads
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsLimit, setLeadsLimit] = useState(25);
  const [leadsStatus, setLeadsStatus] = useState<string>('');
  const [leadsSortDir, setLeadsSortDir] = useState<'asc' | 'desc'>('desc');

  const [isLeadOpen, setIsLeadOpen] = useState(false);
  const [leadLoading, setLeadLoading] = useState(false);
  const [activeLead, setActiveLead] = useState<any | null>(null);
  const [deleteLeadConfirmId, setDeleteLeadConfirmId] = useState<string>('');

  const loadLeads = async (page = leadsPage) => {
    if (!token) return;
    const data = await adminFetchLeads(token, {
      page,
      limit: leadsLimit,
      status: leadsStatus || undefined,
      sortDir: leadsSortDir,
    });
    setLeads(data.items || []);
    setLeadsTotal(Number(data.total || 0));
    setLeadsPage(Number(data.page || page));
  };

  const openLead = async (id: string) => {
    if (!token) return;
    setIsLeadOpen(true);
    setLeadLoading(true);
    setActiveLead(null);
    try {
      const data = await adminFetchLead(token, id);
      setActiveLead(data.lead);
    } finally {
      setLeadLoading(false);
    }
  };

  const loadOrders = async (page = ordersPage) => {
    if (!token) return;
    const data = await adminFetchOrders(token, {
      page,
      limit: ordersLimit,
      status: ordersStatus || undefined,
      sortBy: ordersSortBy,
      sortDir: ordersSortDir,
    });
    setOrders(data.items || []);
    setOrdersTotal(Number(data.total || 0));
    setOrdersPage(Number(data.page || page));
  };

  const openOrder = async (id: string) => {
    if (!token) return;
    setIsOrderOpen(true);
    setOrderLoading(true);
    setActiveOrder(null);
    try {
      const data = await adminFetchOrder(token, id);
      setActiveOrder(data.order);
    } finally {
      setOrderLoading(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const parseNum = (v: string) => {
    const s = String(v || '').trim();
    if (!s) return undefined;
    const n = Number(s.replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

  const ATTR_EDITOR_LABELS: Record<string, string> = {
    thickness_mm: 'Толщина',
    roll_size_mm: 'Размер рулона',
    pack_area_m2: 'Площадь в пачке (м2)',
    pack_volume_m3: 'Объем в пачке (м3)',
    roll_area_m2: 'Площадь в рулоне (м2)',
    pack_qty: 'Кратность',
    marking: 'Маркировка',
    specs_text: 'Характеристики',
  };

  const attrsToEditorText = (attrs: any) => {
    const entries = Object.entries(attrs || {})
      .map(([k, v]) => [String(k || ''), String(v || '').trim()] as const)
      .filter(([, v]) => Boolean(v));

    if (!entries.length) return '';

    if (entries.length === 1 && entries[0][0] === 'specs_text') {
      return entries[0][1];
    }

    return entries
      .map(([k, v]) => `${ATTR_EDITOR_LABELS[k] || k}: ${v}`)
      .join(', ');
  };

  const normalizeImageSlots = (images: any, fallbackImage = '') => {
    const list = (Array.isArray(images) ? images : [])
      .map((x) => String(x || '').trim())
      .filter(Boolean);

    const fallback = String(fallbackImage || '').trim();
    if (fallback && !list.includes(fallback)) list.unshift(fallback);

    return [...list.slice(0, 3), '', '', ''].slice(0, 3);
  };

  const filledImages = (images: any) =>
    Array.from(
      new Set(
        (Array.isArray(images) ? images : [])
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 3);

  const uploadConstructorImage = async (file: File) => {
    const adminToken = getAdminToken() || '';
    return adminUploadImage(adminToken, file);
  };

  const updateHomepageImages = (patch: Partial<HomepageImages>) => {
    setSiteForm((prev) => ({
      ...prev,
      homepageImages: {
        ...mergeHomepageImages(prev.homepageImages),
        ...patch,
      },
    }));
  };

  const updateHomepageProductSlide = (id: string, image: string) => {
    setSiteForm((prev) => ({
      ...prev,
      homepageImages: {
        ...mergeHomepageImages(prev.homepageImages),
        productSlides: mergeHomepageImages(prev.homepageImages).productSlides.map((item) =>
          item.id === id ? { ...item, image } : item
        ),
      },
    }));
  };

  const updateHomepagePartnerLogo = (index: number, image: string) => {
    const nextLogos = [...mergeHomepageImages(siteForm.homepageImages).partnerLogos];
    nextLogos[index] = image;
    updateHomepageImages({ partnerLogos: nextLogos });
  };

  const refreshAdmin = async () => {
    const data = await fetchAdminCatalog(token);
    setAdminCategories(data.categories as any);
  };

  const refreshPublic = async () => {
    const data = await fetchCatalog();
    setCategories(data.categories as any);
  };

  const refreshAll = async () => {
    await Promise.allSettled([refreshAdmin(), refreshPublic()]);
  };

  const loadSiteSettings = async () => {
    if (!token) return;
    setConstructorLoading(true);
    try {
      const data = await adminGetSiteSettings(token);
      const s = data?.settings || {};
      setSiteForm(mergeSiteSettings(s));
    } catch (error) {
      console.error(error);
    } finally {
      setConstructorLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    loadSiteSettings();
  }, []);

  useEffect(() => {
    if (activeTab !== 'constructor') return;
    loadSiteSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

useEffect(() => {
    if (activeTab !== 'orders') return;
    loadOrders(ordersPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ordersPage, ordersLimit, ordersStatus, ordersSortBy, ordersSortDir]);

  useEffect(() => {
    if (activeTab !== 'leads') return;
    loadLeads(leadsPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, leadsPage, leadsLimit, leadsStatus, leadsSortDir]);

  useEffect(() => { setInvPage(1); }, [searchTerm]);

  useEffect(() => {
    setCategoryImageDrafts((prev) => {
      const next = { ...prev };
      adminCategories.forEach((cat: any) => {
        const id = String(cat.id || "");
        if (!id) return;
        if (next[id] === undefined || next[id] === "") {
          const fallback = String((cat.items || []).find((it: any) => it?.image)?.image || "");
          next[id] = String(cat.image || "") || fallback;
        }
      });
      return next;
    });
  }, [adminCategories]);


  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedImportSupplier) {
      alert('Сначала выберите поставщика для импорта.');
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const result = await adminImportExcel(token, file, selectedImportSupplier);
      await refreshAll();
      const durationSec = Number(result?.durationMs || 0) > 0 ? ` · ${Math.round(Number(result.durationMs) / 1000)} сек` : '';
      setImportResult({
        type: 'success',
        title: `Импорт ${result?.supplier?.title || ''} завершён`,
        details: `Распознано: ${result.totalParsed} · Добавлено: ${result.inserted} · Обновлено: ${result.updated} · Пропущено: ${result.skipped}${durationSec}`,
      });
      setActiveTab('inventory');
    } catch (error: any) {
      console.error(error);
      setImportResult({
        type: 'error',
        title: 'Ошибка при импорте',
        details: error?.message || 'Не удалось обработать файл Excel',
      });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handlePurgeAllData = async () => {
    if (!token) return;
    const firstConfirm = window.confirm('Это действие удалит ВСЕ товары, категории, заказы и заявки из базы. Продолжить?');
    if (!firstConfirm) return;

    const textConfirm = window.prompt('Для подтверждения введите: DELETE_ALL');
    if (textConfirm !== 'DELETE_ALL') {
      alert('Удаление отменено: неверная фраза подтверждения.');
      return;
    }

    const purgePassword = window.prompt('Введите специальный пароль для полного удаления:');
    if (!purgePassword) {
      alert('Удаление отменено: пароль не введён.');
      return;
    }

    setIsPurgingAll(true);
    try {
      const result = await adminPurgeAll(token, purgePassword);
      await refreshAll();
      const d = result?.deleted || { products: 0, categories: 0, orders: 0, leads: 0 };
      alert(`База очищена: товары ${d.products}, категории ${d.categories}, заказы ${d.orders}, заявки ${d.leads}`);
      setActiveTab('inventory');
    } catch (error: any) {
      alert(error?.message || 'Ошибка полного удаления базы');
    } finally {
      setIsPurgingAll(false);
    }
  };

  const saveSiteConstructor = async () => {
    if (!token) return;
    setConstructorSaving(true);
    try {
      const homepageImages = mergeHomepageImages(siteForm.homepageImages);
      const payload = {
        ...siteForm,
        heroSlides: (siteForm.heroSlides || []).map((s) => ({
          title: String(s.title || '').trim(),
          subtitle: String(s.subtitle || '').trim(),
          desc: String(s.desc || '').trim(),
          img: String(s.img || '').trim(),
        })),
        aboutSlides: (siteForm.aboutSlides || []).map((s) => ({
          title: String(s.title || '').trim(),
          text: String(s.text || '').trim(),
          imageUrl: String(s.imageUrl || '').trim(),
          bullets: Array.isArray(s.bullets)
            ? s.bullets.map((b) => String(b || '').trim()).filter(Boolean)
            : [],
        })),
        homepageImages: {
          headerLogo: String(homepageImages.headerLogo || '').trim(),
          footerLogo: String(homepageImages.footerLogo || '').trim(),
          partnersBackground: String(homepageImages.partnersBackground || '').trim(),
          productSlides: (homepageImages.productSlides || []).map((item) => ({
            id: String(item.id || '').trim(),
            image: String(item.image || '').trim(),
          })),
          partnerLogos: (homepageImages.partnerLogos || [])
            .map((item) => String(item || '').trim())
            .filter(Boolean),
        },
      };
      await adminSaveSiteSettings(token, payload);
      alert('Конструктор главной страницы сохранен');
    } catch (error: any) {
      console.error(error);
      alert(error?.message || 'Ошибка при сохранении конструктора');
    } finally {
      setConstructorSaving(false);
    }
  };

  const toggleProductStock = async (prodId: string, current: boolean) => {
    try {
      await adminPatchProduct(token, prodId, { inStock: !current });
      await refreshAll();
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    }
  };

  const openEditModal = (prod: any, categoryTitle: string) => {
    setEditId(String(prod.id));
    setEditForm({
      category_title: categoryTitle,
      name: String(prod.name || ''),
      brandOrGroup: String(prod.brandOrGroup || ''),
      unit: String(prod.unit || 'шт'),
      sku: String(prod.sku || ''),
      image: String(prod.image || ''),
      images: normalizeImageSlots(prod.images, String(prod.image || '')),
      description: String(prod.description || ''),
      prices: {
        retail: prod?.prices?.retail !== undefined ? String(prod.prices.retail) : '',
      },
      attrsText: attrsToEditorText(prod?.attrs || {}),
      inStock: !!prod.inStock,
    });
    setIsEditOpen(true);
  };

  const submitEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;

    const prices: any = {};
    const retail = parseNum(editForm.prices.retail);

    if (retail !== undefined) prices.retail = retail;

    const attrsText = String(editForm.attrsText || '').trim();
    const attrs: any = attrsText ? { specs_text: attrsText } : {};

    try {
      const images = filledImages(editForm.images);
      await adminPatchProduct(token, editId, {
        name: editForm.name,
        brandOrGroup: editForm.brandOrGroup,
        unit: editForm.unit,
        sku: editForm.sku,
        image: images[0] || '',
        images,
        description: editForm.description,
        inStock: editForm.inStock,
        prices,
        attrs,
      });
      setIsEditOpen(false);
      await refreshAll();
    } catch (err: any) {
      alert(err?.message || 'Ошибка');
    }
  };

  const deleteProduct = async (prodId: string) => {
    if (!confirm('Удалить товар навсегда?')) return;
    try {
      await adminDeleteProduct(token, prodId);
      await refreshAll();
    } catch (e: any) {
      alert(e?.message || 'Ошибка');
    }
  };

  const openAddModal = () => {
    setAddForm({
      category_title: '',
      name: '',
      brandOrGroup: '',
      unit: 'шт',
      sku: '',
      image: '',
      images: ['', '', ''],
      description: '',
      prices: {
        retail: '',
      },
      attrsText: '',
      inStock: true,
    });
    setIsAddOpen(true);
  };

  const toNumberOrUndefined = (v: string) => {
    const s = String(v || '').trim();
    if (!s) return undefined;
    const n = Number(s.replace(/\s+/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

  const uploadImageForAdd = async (slotIndex: number, file?: File | null) => {
    if (!file || !token) return;
    setAddImageUploading(true);
    try {
      const res = await adminUploadProductImage(token, file);
      setAddForm((prev) => {
        const images = normalizeImageSlots(prev.images, prev.image);
        images[slotIndex] = String(res.imageUrl || '');
        const first = filledImages(images)[0] || '';
        return { ...prev, images, image: first };
      });
    } catch (e: any) {
      alert(e?.message || 'Ошибка загрузки изображения');
    } finally {
      setAddImageUploading(false);
    }
  };

  const uploadImageForEdit = async (slotIndex: number, file?: File | null) => {
    if (!file || !token) return;
    setEditImageUploading(true);
    try {
      const res = await adminUploadProductImage(token, file);
      setEditForm((prev) => {
        const images = normalizeImageSlots(prev.images, prev.image);
        images[slotIndex] = String(res.imageUrl || '');
        const first = filledImages(images)[0] || '';
        return { ...prev, images, image: first };
      });
    } catch (e: any) {
      alert(e?.message || 'Ошибка загрузки изображения');
    } finally {
      setEditImageUploading(false);
    }
  };

  const saveCategoryImage = async (catId: string, title: string) => {
    if (!token) return;
    const image = String(categoryImageDrafts[catId] || "");
    setCategoryImageSaving((prev) => ({ ...prev, [catId]: true }));
    try {
      await adminPatchCategory(token, catId, { image, title });
      await refreshAll();
    } catch (e: any) {
      alert(e?.message || "Ошибка сохранения категории");
    } finally {
      setCategoryImageSaving((prev) => ({ ...prev, [catId]: false }));
    }
  };

  const uploadCategoryImage = async (catId: string, title: string, file?: File | null) => {
    if (!file || !token) return;
    setCategoryImageUploading((prev) => ({ ...prev, [catId]: true }));
    try {
      const res = await adminUploadProductImage(token, file);
      const imageUrl = String(res.imageUrl || "");
      setCategoryImageDrafts((prev) => ({ ...prev, [catId]: imageUrl }));
      await adminPatchCategory(token, catId, { image: imageUrl, title });
      await refreshAll();
    } catch (e: any) {
      alert(e?.message || "Ошибка загрузки изображения");
    } finally {
      setCategoryImageUploading((prev) => ({ ...prev, [catId]: false }));
    }
  };

  const submitAddProduct = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const category_title = addForm.category_title.trim();
    const name = addForm.name.trim();
    if (!category_title || !name) {
      alert('Заполните категорию и наименование');
      return;
    }

    const payload: any = {
      category_title,
      name,
      brandOrGroup: addForm.brandOrGroup.trim(),
      unit: addForm.unit.trim() || 'шт',
      sku: addForm.sku.trim(),
      description: addForm.description.trim(),
      inStock: !!addForm.inStock,
      prices: {},
      attrs: {},
    };

    const images = filledImages(addForm.images);
    payload.images = images;
    payload.image = images[0] || '';

    const prices: any = {};
    const p = addForm.prices;
    const retail = toNumberOrUndefined(p.retail);
    if (retail !== undefined) prices.retail = retail;
    payload.prices = prices;

    const attrsText = String(addForm.attrsText || '').trim();
    payload.attrs = attrsText ? { specs_text: attrsText } : {};

    try {
      await adminCreateProduct(token, payload);
      setIsAddOpen(false);
      await refreshAll();
    } catch (err: any) {
      alert(err?.message || 'Ошибка');
    }
  };

  const totalCount = adminCategories.reduce((s, c) => s + c.items.length, 0);

  const invAll: any[] = adminCategories.flatMap((cat: any) =>
    (cat.items || []).map((p: any) => ({ ...p, __catTitle: cat.title }))
  );

  const invFiltered = invAll.filter((p: any) =>
    String(p?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const invTotalPages = Math.max(1, Math.ceil(invFiltered.length / INV_PAGE_SIZE));
  const invPageSafe = Math.min(invPage, invTotalPages);
  const invItems = invFiltered.slice((invPageSafe - 1) * INV_PAGE_SIZE, invPageSafe * INV_PAGE_SIZE);

  const InvPager = () => (
    <div className="flex items-center justify-center gap-3 py-4">
      <button
        type="button"
        onClick={() => setInvPage((p) => Math.max(1, p - 1))}
        disabled={invPageSafe <= 1}
        className={`px-4 py-2 rounded-xl font-bold text-sm border ${
          invPageSafe <= 1 ? 'bg-gray-100 text-gray-400 border-gray-100' : 'bg-white hover:bg-gray-50 border-gray-200'
        }`}
      >
        ← Назад
      </button>
      <div className="text-sm font-bold text-gray-600">
        Страница {invPageSafe} / {invTotalPages}
      </div>
      <button
        type="button"
        onClick={() => setInvPage((p) => Math.min(invTotalPages, p + 1))}
        disabled={invPageSafe >= invTotalPages}
        className={`px-4 py-2 rounded-xl font-bold text-sm border ${
          invPageSafe >= invTotalPages ? 'bg-gray-100 text-gray-400 border-gray-100' : 'bg-white hover:bg-gray-50 border-gray-200'
        }`}
      >
        Вперёд →
      </button>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black text-blue-900 uppercase tracking-tighter">Панель управления</h1>
          <p className="text-gray-500 font-medium">Управление каталогом и импорт данных</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePurgeAllData}
            disabled={isPurgingAll}
            className={`px-6 py-3 font-bold rounded-xl transition-all text-sm uppercase tracking-widest ${isPurgingAll ? 'bg-red-100 text-red-300 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
            title="Полностью удалить данные из базы"
          >
            {isPurgingAll ? 'Очистка...' : 'Удалить все из БД'}
          </button>
          <button 
            onClick={onLogout}
            className="px-6 py-3 bg-red-50 text-red-500 font-bold rounded-xl hover:bg-red-500 hover:text-white transition-all text-sm uppercase tracking-widest"
          >
            Выйти
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`px-8 py-4 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest ${activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-gray-400 hover:bg-blue-50'}`}
        >
          <i className="fas fa-boxes mr-2"></i> Инвентарь
        </button>
        <button 
          onClick={() => setActiveTab('import')}
          className={`px-8 py-4 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest ${activeTab === 'import' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-gray-400 hover:bg-blue-50'}`}
        >
          <i className="fas fa-file-import mr-2"></i> Импорт Excel
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`px-8 py-4 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest ${activeTab === 'orders' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-gray-400 hover:bg-blue-50'}`}
        >
          <i className="fas fa-clipboard-list mr-2"></i> Заказы
        </button>
        <button 
          onClick={() => setActiveTab('leads')}
          className={`px-8 py-4 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest ${activeTab === 'leads' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-gray-400 hover:bg-blue-50'}`}
        >
          <i className="fas fa-inbox mr-2"></i> Заявки
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`px-8 py-4 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest ${activeTab === 'categories' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-gray-400 hover:bg-blue-50'}`}
        >
          <i className="fas fa-images mr-2"></i> Категории
        </button>
        <button
          onClick={() => setActiveTab('constructor')}
          className={`px-8 py-4 rounded-2xl font-bold transition-all uppercase text-xs tracking-widest ${activeTab === 'constructor' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-white text-gray-400 hover:bg-blue-50'}`}
        >
          <i className="fas fa-pen-ruler mr-2"></i> Конструктор главной
        </button>
      </div>

      <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden">
        {activeTab === 'import' ? (
          <div className="p-20 text-center">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8 text-blue-400 text-4xl">
              <i className="fas fa-file-excel"></i>
            </div>
            <h3 className="text-3xl font-black text-blue-900 mb-4 uppercase tracking-tighter">Загрузка каталога</h3>
            <p className="text-gray-400 max-w-2xl mx-auto mb-10 font-medium">Сначала выберите поставщика, затем загрузите Excel в шаблоне с колонками: Номенклатура, Количество, Описание, Картинка 1-3, Артикул, Цена. Если колонка единицы измерения отсутствует, будет использовано значение "шт".</p>

            <div className="max-w-4xl mx-auto mb-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 text-left">
              {IMPORT_SUPPLIERS.map((supplier) => {
                const isActive = selectedImportSupplier === supplier.id;
                return (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => setSelectedImportSupplier(supplier.id)}
                    className={`rounded-3xl border px-6 py-5 transition-all ${isActive ? 'border-blue-600 bg-blue-600 text-white shadow-xl shadow-blue-100' : 'border-gray-200 bg-gray-50 text-blue-900 hover:border-blue-300 hover:bg-blue-50'}`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.3em] font-black opacity-70 mb-2">Поставщик</div>
                    <div className="text-lg font-black tracking-tight">{supplier.title}</div>
                  </button>
                );
              })}
            </div>

            <label className={`inline-flex items-center gap-4 px-12 py-6 rounded-3xl font-black uppercase tracking-widest text-sm cursor-pointer transition-all ${isImporting ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xl shadow-blue-200 hover:-translate-y-1'}`}>
              {isImporting ? (
                <><i className="fas fa-spinner fa-spin"></i> Обработка...</>
              ) : (
                <><i className="fas fa-cloud-upload-alt text-xl"></i> {selectedImportSupplier ? 'Выбрать файл Excel' : 'Сначала выберите поставщика'}</>
              )}
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} disabled={isImporting || !selectedImportSupplier} />
            </label>
            {selectedImportSupplier ? (
              <p className="mt-5 text-sm text-blue-700 font-semibold">
                Импорт будет выполнен в категорию {IMPORT_SUPPLIERS.find((item) => item.id === selectedImportSupplier)?.title || selectedImportSupplier}.
              </p>
            ) : null}
          </div>
        ) : activeTab === 'orders' ? (
          <div className="p-10">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-6">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Заказы</h3>
                <p className="text-gray-500 text-sm mt-1">История заказов из корзины</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={ordersStatus}
                  onChange={(e) => { setOrdersPage(1); setOrdersStatus(e.target.value); }}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-semibold text-sm"
                >
                  <option value="">Все статусы</option>
                  <option value="new">Новые</option>
                  <option value="processing">В обработке</option>
                  <option value="completed">Выполнены</option>
                  <option value="cancelled">Отменены</option>
                </select>

                <select
                  value={ordersSortBy}
                  onChange={(e) => { setOrdersPage(1); setOrdersSortBy(e.target.value as any); }}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-semibold text-sm"
                >
                  <option value="date">Сортировка: Дата</option>
                  <option value="status">Сортировка: Статус</option>
                </select>

                <select
                  value={ordersSortDir}
                  onChange={(e) => { setOrdersPage(1); setOrdersSortDir(e.target.value as any); }}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-semibold text-sm"
                >
                  <option value="desc">Сначала новые</option>
                  <option value="asc">Сначала старые</option>
                </select>

                <button
                  onClick={() => loadOrders(ordersPage)}
                  className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200"
                >
                  Обновить
                </button>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="p-16 text-center bg-gray-50 rounded-3xl border border-gray-100">
                <div className="text-gray-400 text-4xl mb-4"><i className="fas fa-inbox"></i></div>
                <div className="font-bold text-gray-700">Пока нет заказов</div>
                <div className="text-sm text-gray-500 mt-2">Когда клиент оформит заказ, он появится здесь.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest text-gray-500">
                      <th className="py-3 px-2">Дата</th>
                      <th className="py-3 px-2">Клиент</th>
                      <th className="py-3 px-2">Телефон</th>
                      <th className="py-3 px-2">Сумма</th>
                      <th className="py-3 px-2">Статус</th>
                      <th className="py-3 px-2 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t border-gray-100 hover:bg-blue-50/40">
                        <td className="py-4 px-2 text-sm text-gray-700">{o.createdAt ? new Date(o.createdAt).toLocaleString('ru-RU') : '-'}</td>
                        <td className="py-4 px-2 font-bold text-blue-900">{o.customerName}</td>
                        <td className="py-4 px-2 text-sm text-gray-700">{o.customerPhone}</td>
                        <td className="py-4 px-2 font-bold text-gray-900">{Number(o.total || 0).toLocaleString('ru-RU')} ₸</td>

                        <td className="py-4 px-2">
                          <select
                            value={o.status}
                            onChange={async (e) => {
                              const st = e.target.value;
                              await adminPatchOrder(token, o.id, st);
                              setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, status: st } : x));
                            }}
                            className="px-3 py-2 rounded-xl border border-gray-200 bg-white font-bold text-xs"
                          >
                            <option value="new">Новый</option>
                            <option value="processing">В обработке</option>
                            <option value="completed">Выполнен</option>
                            <option value="cancelled">Отменён</option>
                          </select>
                        </td>

                        <td className="py-4 px-2 text-right">
                          <button
                            onClick={() => openOrder(o.id)}
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest mr-2"
                          >
                            Открыть
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(o.id)}
                            className="px-4 py-2 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500">
                    Всего: <span className="font-bold text-gray-800">{ordersTotal}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white font-bold text-xs uppercase tracking-widest"
                      disabled={ordersPage <= 1}
                    >
                      Назад
                    </button>
                    <button
                      onClick={() => setOrdersPage((p) => p + 1)}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white font-bold text-xs uppercase tracking-widest"
                      disabled={ordersPage * ordersLimit >= ordersTotal}
                    >
                      Далее
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete confirm modal */}
            {deleteConfirmId ? (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
                <div className="bg-white rounded-3xl p-8 w-[92%] max-w-md shadow-2xl">
                  <h4 className="text-xl font-black text-blue-900 uppercase tracking-tighter mb-2">Подтвердите удаление</h4>
                  <p className="text-gray-600 text-sm mb-6">Удалить заказ навсегда? Это действие нельзя отменить.</p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setDeleteConfirmId('')}
                      className="px-6 py-3 rounded-2xl border border-gray-200 bg-white font-black text-xs uppercase tracking-widest"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={async () => {
                        const id = deleteConfirmId;
                        setDeleteConfirmId('');
                        await adminDeleteOrder(token, id);
                        await loadOrders(ordersPage);
                      }}
                      className="px-6 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Order modal */}
            {isOrderOpen ? (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
                <div className="bg-white rounded-3xl p-8 w-[95%] max-w-4xl shadow-2xl max-h-[85vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <h4 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Заказ</h4>
                      {activeOrder?.createdAt ? (
                        <div className="text-sm text-gray-500 mt-1">{new Date(activeOrder.createdAt).toLocaleString('ru-RU')}</div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => { setIsOrderOpen(false); setActiveOrder(null); }}
                      className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  {orderLoading ? (
                    <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i>Загрузка...</div>
                  ) : !activeOrder ? (
                    <div className="p-10 text-center text-gray-500">Заказ не найден</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                          <div className="text-xs uppercase tracking-widest text-gray-500">Клиент</div>
                          <div className="mt-2 font-black text-blue-900 text-lg">{activeOrder.customerName}</div>
                          <div className="mt-1 text-sm text-gray-700">{activeOrder.customerPhone}</div>
                          {activeOrder.customerEmail ? <div className="mt-1 text-sm text-gray-700">{activeOrder.customerEmail}</div> : null}
                          <div className="mt-3 text-sm text-gray-700"><span className="font-bold">Доставка:</span> {activeOrder.deliveryMethod === 'pickup' ? 'Самовывоз (бесплатно)' : activeOrder.deliveryMethod === 'transport_company' ? 'Транспортная компания (inDrive, CDEK)' : 'Доставка курьером по Астане'}</div>
                          <div className="mt-1 text-sm text-gray-700"><span className="font-bold">Оплата:</span> {activeOrder.paymentMethod === 'halyk' ? 'Halyk Bank (онлайн-оплата)' : 'Kaspi Pay (Gold, Red, Рассрочка)'}</div>
                          {activeOrder.address ? <div className="mt-3 text-sm text-gray-700"><span className="font-bold">Адрес:</span> {activeOrder.address}</div> : null}
                          {activeOrder.comment ? <div className="mt-3 text-sm text-gray-700"><span className="font-bold">Комментарий:</span> {activeOrder.comment}</div> : null}
                        </div>

                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                          <div className="text-xs uppercase tracking-widest text-gray-500">Статус и сумма</div>
                          <div className="mt-4 flex flex-col gap-3">
                            <select
                              value={activeOrder.status}
                              onChange={async (e) => {
                                const st = e.target.value;
                                await adminPatchOrder(token, activeOrder.id, st);
                                setActiveOrder((prev: any) => ({ ...prev, status: st }));
                                setOrders((prev) => prev.map((x) => x.id === activeOrder.id ? { ...x, status: st } : x));
                              }}
                              className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-sm"
                            >
                              <option value="new">Новый</option>
                              <option value="processing">В обработке</option>
                              <option value="completed">Выполнен</option>
                              <option value="cancelled">Отменён</option>
                            </select>

                            <div className="text-3xl font-black text-gray-900">
                              {Number(activeOrder.total || 0).toLocaleString('ru-RU')} ₸
                            </div>

                            <button
                              onClick={async () => {
                                const blob = await adminExportOrder(token, activeOrder.id);
                                downloadBlob(blob, `order_${activeOrder.id}.xlsx`);
                              }}
                              className="px-6 py-3 rounded-2xl bg-green-600 text-white font-black uppercase text-xs tracking-widest"
                            >
                              Экспорт в Excel
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 font-black text-blue-900 uppercase tracking-widest text-xs">
                          Товары
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-xs uppercase tracking-widest text-gray-500">
                                <th className="py-3 px-4">Товар</th>
                                <th className="py-3 px-4">Артикул</th>
                                <th className="py-3 px-4 text-right">Кол-во</th>
                                <th className="py-3 px-4 text-right">Цена</th>
                                <th className="py-3 px-4 text-right">Сумма</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeOrder.items || []).map((it: any, idx2: number) => (
                                <tr key={idx2} className="border-t border-gray-100">
                                  <td className="py-4 px-4 font-bold text-gray-900">{it.name}</td>
                                  <td className="py-4 px-4 text-sm text-gray-700">{it.sku || '-'}</td>
                                  <td className="py-4 px-4 text-right font-bold">{Number(it.quantity || 0)}</td>
                                  <td className="py-4 px-4 text-right">{Number(it.price || 0).toLocaleString('ru-RU')} ₸</td>
                                  <td className="py-4 px-4 text-right font-black">{Number(it.lineTotal || 0).toLocaleString('ru-RU')} ₸</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : activeTab === 'leads' ? (
          <div className="p-10">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-6">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Заявки</h3>
                <p className="text-gray-500 text-sm mt-1">Заявки с формы на главной странице</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={leadsStatus}
                  onChange={(e) => { setLeadsPage(1); setLeadsStatus(e.target.value); }}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-semibold text-sm"
                >
                  <option value="">Все статусы</option>
                  <option value="new">Новые</option>
                  <option value="processing">В обработке</option>
                  <option value="done">Выполнены</option>
                </select>

                <select
                  value={leadsSortDir}
                  onChange={(e) => { setLeadsPage(1); setLeadsSortDir(e.target.value as any); }}
                  className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-semibold text-sm"
                >
                  <option value="desc">Сначала новые</option>
                  <option value="asc">Сначала старые</option>
                </select>

                <button
                  onClick={() => loadLeads(leadsPage)}
                  className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200"
                >
                  Обновить
                </button>
              </div>
            </div>

            {leads.length === 0 ? (
              <div className="p-16 text-center bg-gray-50 rounded-3xl border border-gray-100">
                <div className="text-gray-400 text-4xl mb-4"><i className="fas fa-inbox"></i></div>
                <div className="font-bold text-gray-700">Пока нет заявок</div>
                <div className="text-sm text-gray-500 mt-2">Когда клиент отправит заявку, она появится здесь.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-widest text-gray-500">
                      <th className="py-3 px-2">Дата</th>
                      <th className="py-3 px-2">Имя</th>
                      <th className="py-3 px-2">Телефон</th>
                      <th className="py-3 px-2">Статус</th>
                      <th className="py-3 px-2 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id} className="border-t border-gray-100 hover:bg-blue-50/40">
                        <td className="py-4 px-2 text-sm text-gray-700">{l.createdAt ? new Date(l.createdAt).toLocaleString('ru-RU') : '-'}</td>
                        <td className="py-4 px-2 font-bold text-blue-900">{l.name}</td>
                        <td className="py-4 px-2 text-sm text-gray-700">{l.phone}</td>
                        <td className="py-4 px-2">
                          <select
                            value={l.status}
                            onChange={async (e) => {
                              const st = e.target.value;
                              await adminPatchLead(token, l.id, st);
                              setLeads((prev) => prev.map((x) => x.id === l.id ? { ...x, status: st } : x));
                            }}
                            className="px-3 py-2 rounded-xl border border-gray-200 bg-white font-bold text-xs"
                          >
                            <option value="new">Новая</option>
                            <option value="processing">В обработке</option>
                            <option value="done">Выполнена</option>
                          </select>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <button
                            onClick={() => openLead(l.id)}
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-widest mr-2"
                          >
                            Открыть
                          </button>
                          <button
                            onClick={() => setDeleteLeadConfirmId(l.id)}
                            className="px-4 py-2 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest"
                          >
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500">
                    Всего: <span className="font-bold text-gray-800">{leadsTotal}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setLeadsPage((p) => Math.max(1, p - 1))}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white font-bold text-xs uppercase tracking-widest"
                      disabled={leadsPage <= 1}
                    >
                      Назад
                    </button>
                    <button
                      onClick={() => setLeadsPage((p) => p + 1)}
                      className="px-4 py-2 rounded-xl border border-gray-200 bg-white font-bold text-xs uppercase tracking-widest"
                      disabled={leadsPage * leadsLimit >= leadsTotal}
                    >
                      Далее
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete confirm modal */}
            {deleteLeadConfirmId ? (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
                <div className="bg-white rounded-3xl p-8 w-[92%] max-w-md shadow-2xl">
                  <h4 className="text-xl font-black text-blue-900 uppercase tracking-tighter mb-2">Подтвердите удаление</h4>
                  <p className="text-gray-600 text-sm mb-6">Удалить заявку навсегда? Это действие нельзя отменить.</p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setDeleteLeadConfirmId('')}
                      className="px-6 py-3 rounded-2xl border border-gray-200 bg-white font-black text-xs uppercase tracking-widest"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={async () => {
                        const id = deleteLeadConfirmId;
                        setDeleteLeadConfirmId('');
                        await adminDeleteLead(token, id);
                        await loadLeads(leadsPage);
                      }}
                      className="px-6 py-3 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Lead modal */}
            {isLeadOpen ? (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
                <div className="bg-white rounded-3xl p-8 w-[95%] max-w-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <h4 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Заявка</h4>
                      {activeLead?.createdAt ? (
                        <div className="text-sm text-gray-500 mt-1">{new Date(activeLead.createdAt).toLocaleString('ru-RU')}</div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => { setIsLeadOpen(false); setActiveLead(null); }}
                      className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>

                  {leadLoading ? (
                    <div className="p-10 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i>Загрузка...</div>
                  ) : !activeLead ? (
                    <div className="p-10 text-center text-gray-500">Заявка не найдена</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                          <div className="text-xs uppercase tracking-widest text-gray-500">Контакты</div>
                          <div className="mt-2 font-black text-blue-900 text-lg">{activeLead.name}</div>
                          <div className="mt-1 text-sm text-gray-700">{activeLead.phone}</div>
                          {activeLead.email ? <div className="mt-1 text-sm text-gray-700">{activeLead.email}</div> : null}
                        </div>

                        <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                          <div className="text-xs uppercase tracking-widest text-gray-500">Статус</div>
                          <div className="mt-4">
                            <select
                              value={activeLead.status}
                              onChange={async (e) => {
                                const st = e.target.value;
                                await adminPatchLead(token, activeLead.id, st);
                                setActiveLead((prev: any) => ({ ...prev, status: st }));
                                setLeads((prev) => prev.map((x) => x.id === activeLead.id ? { ...x, status: st } : x));
                              }}
                              className="px-4 py-3 rounded-2xl border border-gray-200 bg-white font-bold text-sm w-full"
                            >
                              <option value="new">Новая</option>
                              <option value="processing">В обработке</option>
                              <option value="done">Выполнена</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {activeLead.message ? (
                        <div className="mt-6 bg-white rounded-3xl border border-gray-100 overflow-hidden">
                          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 font-black text-blue-900 uppercase tracking-widest text-xs">
                            Сообщение
                          </div>
                          <div className="p-6 text-gray-800 whitespace-pre-wrap">{activeLead.message}</div>
                        </div>
                      ) : null}

                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>

        ) : activeTab === 'categories' ? (
          <div className="p-10">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-6">
              <div className="flex-1">
                <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Категории</h3>
                <p className="text-gray-500 text-sm mt-1">Изображения для карточек каталога на главной странице</p>
              </div>
              <button
                onClick={() => refreshAll()}
                className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-200"
              >
                Обновить
              </button>
            </div>

            {adminCategories.length === 0 ? (
              <div className="p-16 text-center bg-gray-50 rounded-3xl border border-gray-100">
                <div className="text-gray-400 text-4xl mb-4"><i className="fas fa-images"></i></div>
                <div className="font-bold text-gray-700">Категории не найдены</div>
                <div className="text-sm text-gray-500 mt-2">Импортируйте товары, чтобы появились категории.</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {adminCategories.map((cat: any) => {
                  const catId = String(cat.id || "");
                  const title = String(cat.title || "");
                  const draft = categoryImageDrafts[catId] ?? "";
                  const fallback = String((cat.items || []).find((it: any) => it?.image)?.image || "");
                  const previewSrc = draft || String(cat.image || "") || fallback;
                  const isUploading = !!categoryImageUploading[catId];
                  const isSaving = !!categoryImageSaving[catId];

                  return (
                    <div key={catId} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                      <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 mb-4">
                        {previewSrc ? (
                          <img src={previewSrc} alt={title} className="w-full h-full object-cover" />
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                          <div className="text-lg font-black text-blue-900">{title || "Без названия"}</div>
                          <div className="text-xs text-gray-400">{catId}</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Изображение (URL)</div>
                          <input
                            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                            value={draft}
                            onChange={(e) => setCategoryImageDrafts((prev) => ({ ...prev, [catId]: e.target.value }))}
                            placeholder="https://..."
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <label className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest ${isUploading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer'}`}>
                            <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {isUploading ? 'Загрузка...' : 'Выбрать файл'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={isUploading}
                              onChange={(e) => {
                                uploadCategoryImage(catId, title, e.target.files?.[0]);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => saveCategoryImage(catId, title)}
                            disabled={isSaving || isUploading}
                            className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs ${isSaving || isUploading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'}`}
                          >
                            {isSaving ? 'Сохранение...' : 'Сохранить'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'constructor' ? (
          <div className="p-10 space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
              <div>
                <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Конструктор главной страницы</h3>
                <p className="text-gray-500 text-sm mt-1">Изменяйте тексты, ссылки и изображения без правки кода</p>
              </div>
              <button
                onClick={saveSiteConstructor}
                disabled={constructorSaving || constructorLoading}
                className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs ${constructorSaving || constructorLoading ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'}`}
              >
                {constructorSaving ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>

            {constructorLoading ? (
              <div className="p-16 text-center text-gray-500">Загрузка настроек...</div>
            ) : (
              <>
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <h4 className="text-lg font-black text-blue-900 mb-4 uppercase tracking-wider">Контакты в Header и блоке контактов</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                      value={siteForm.phone || ''}
                      onChange={(e) => setSiteForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Телефон"
                    />
                    <input
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                      value={siteForm.email || ''}
                      onChange={(e) => setSiteForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Email"
                    />
                    <input
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                      value={siteForm.address || ''}
                      onChange={(e) => setSiteForm((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Адрес"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <h4 className="text-lg font-black text-blue-900 mb-4 uppercase tracking-wider">Кнопки рассрочки (Kaspi / Halyk)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!siteForm.kaspiEnabled}
                          onChange={(e) => setSiteForm((prev) => ({ ...prev, kaspiEnabled: e.target.checked }))}
                        />
                        Показать кнопку Kaspi
                      </label>
                      <input
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                        value={siteForm.kaspiUrl || ''}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, kaspiUrl: e.target.value }))}
                        placeholder="Ссылка Kaspi"
                      />
                    </div>
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!siteForm.halykEnabled}
                          onChange={(e) => setSiteForm((prev) => ({ ...prev, halykEnabled: e.target.checked }))}
                        />
                        Показать кнопку Halyk
                      </label>
                      <input
                        className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                        value={siteForm.halykUrl || ''}
                        onChange={(e) => setSiteForm((prev) => ({ ...prev, halykUrl: e.target.value }))}
                        placeholder="Ссылка Halyk"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-6">
                  <h4 className="text-lg font-black text-blue-900 uppercase tracking-wider">Все изображения главной страницы</h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { key: 'headerLogo', label: 'Логотип в Header' },
                      { key: 'footerLogo', label: 'Логотип в Footer' },
                      { key: 'partnersBackground', label: 'Фон секции Партнёры' },
                    ].map((item) => {
                      const value = siteForm.homepageImages?.[item.key as keyof HomepageImages] as string;
                      const preview = normalizeAssetUrl(value);

                      return (
                        <div key={item.key} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                          <div className="text-sm font-black text-gray-700 uppercase">{item.label}</div>
                          <div className="h-32 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                            {preview ? (
                              <img src={preview} alt={item.label} className="w-full h-full object-contain" />
                            ) : (
                              <i className="fas fa-image text-3xl text-gray-300"></i>
                            )}
                          </div>
                          <input
                            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm"
                            value={value || ''}
                            onChange={(e) => updateHomepageImages({ [item.key]: e.target.value } as Partial<HomepageImages>)}
                            placeholder="URL изображения"
                          />
                          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">
                            <i className="fas fa-upload"></i> Загрузить файл
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const url = await uploadConstructorImage(file);
                                  updateHomepageImages({ [item.key]: url } as Partial<HomepageImages>);
                                } catch {
                                  alert('Ошибка загрузки изображения');
                                } finally {
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
                    <div className="text-sm font-black text-gray-700 uppercase">Карточки блока Наша продукция</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {(siteForm.homepageImages?.productSlides || []).map((item) => {
                        const preview = normalizeAssetUrl(item.image);
                        return (
                          <div key={item.id} className="rounded-2xl border border-gray-100 p-4 space-y-3 bg-gray-50">
                            <div className="text-xs font-black text-gray-500 uppercase tracking-widest">{item.id}</div>
                            <div className="h-32 rounded-2xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center">
                              {preview ? (
                                <img src={preview} alt={item.id} className="w-full h-full object-cover" />
                              ) : (
                                <i className="fas fa-image text-3xl text-gray-300"></i>
                              )}
                            </div>
                            <input
                              className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm"
                              value={item.image || ''}
                              onChange={(e) => updateHomepageProductSlide(item.id, e.target.value)}
                              placeholder="URL изображения"
                            />
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">
                              <i className="fas fa-upload"></i> Загрузить файл
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const url = await uploadConstructorImage(file);
                                    updateHomepageProductSlide(item.id, url);
                                  } catch {
                                    alert('Ошибка загрузки изображения');
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
                    <div className="text-sm font-black text-gray-700 uppercase">Логотипы партнёров</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {(siteForm.homepageImages?.partnerLogos || []).map((logo, index) => {
                        const preview = normalizeAssetUrl(logo);
                        return (
                          <div key={`partner-logo-${index}`} className="rounded-2xl border border-gray-100 p-4 space-y-3 bg-gray-50">
                            <div className="text-xs font-black text-gray-500 uppercase tracking-widest">Логотип #{index + 1}</div>
                            <div className="h-28 rounded-2xl overflow-hidden border border-gray-200 bg-white flex items-center justify-center p-3">
                              {preview ? (
                                <img src={preview} alt={`Партнёр ${index + 1}`} className="max-h-full max-w-full object-contain" />
                              ) : (
                                <i className="fas fa-image text-3xl text-gray-300"></i>
                              )}
                            </div>
                            <input
                              className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm"
                              value={logo || ''}
                              onChange={(e) => updateHomepagePartnerLogo(index, e.target.value)}
                              placeholder="URL логотипа"
                            />
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">
                              <i className="fas fa-upload"></i> Загрузить файл
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const url = await uploadConstructorImage(file);
                                    updateHomepagePartnerLogo(index, url);
                                  } catch {
                                    alert('Ошибка загрузки изображения');
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-black text-blue-900 uppercase tracking-wider">Слайды Hero</h4>
                    <button
                      type="button"
                      onClick={() => setSiteForm((prev) => ({
                        ...prev,
                        heroSlides: [...(prev.heroSlides || []), { title: '', subtitle: '', desc: '', img: '' }],
                      }))}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest"
                    >
                      + Добавить слайд
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(siteForm.heroSlides || []).map((slide, idx) => (
                      <div key={`hero-${idx}`} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-black text-gray-700 uppercase">Слайд #{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() => setSiteForm((prev) => ({
                              ...prev,
                              heroSlides: (prev.heroSlides || []).filter((_, i) => i !== idx),
                            }))}
                            className="text-xs font-bold text-red-500"
                          >
                            Удалить
                          </button>
                        </div>
                        <input
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                          value={slide.subtitle || ''}
                          onChange={(e) => setSiteForm((prev) => ({
                            ...prev,
                            heroSlides: (prev.heroSlides || []).map((s, i) => i === idx ? { ...s, subtitle: e.target.value } : s),
                          }))}
                          placeholder="Подзаголовок"
                        />
                        <input
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                          value={slide.title || ''}
                          onChange={(e) => setSiteForm((prev) => ({
                            ...prev,
                            heroSlides: (prev.heroSlides || []).map((s, i) => i === idx ? { ...s, title: e.target.value } : s),
                          }))}
                          placeholder="Заголовок"
                        />
                        <textarea
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 min-h-[90px]"
                          value={slide.desc || ''}
                          onChange={(e) => setSiteForm((prev) => ({
                            ...prev,
                            heroSlides: (prev.heroSlides || []).map((s, i) => i === idx ? { ...s, desc: e.target.value } : s),
                          }))}
                          placeholder="Описание"
                        />
                        {/* Image preview + upload */}
                        <div className="flex gap-3 items-start">
                          {slide.img ? (
                            <div className="relative flex-shrink-0 w-24 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                              <img
                                src={normalizeAssetUrl(slide.img)}
                                alt="preview"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                              <button
                                type="button"
                                title="Удалить изображение"
                                onClick={() => setSiteForm((prev) => ({
                                  ...prev,
                                  heroSlides: (prev.heroSlides || []).map((s, i) => i === idx ? { ...s, img: '' } : s),
                                }))}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shadow"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-24 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-2xl">
                              <i className="fas fa-image"></i>
                            </div>
                          )}
                          <div className="flex-grow space-y-2">
                            <input
                              className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm"
                              value={slide.img || ''}
                              onChange={(e) => setSiteForm((prev) => ({
                                ...prev,
                                heroSlides: (prev.heroSlides || []).map((s, i) => i === idx ? { ...s, img: e.target.value } : s),
                              }))}
                              placeholder="URL изображения (или загрузите файл)"
                            />
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">
                              <i className="fas fa-upload"></i> Загрузить файл
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const url = await uploadConstructorImage(file);
                                    setSiteForm((prev) => ({
                                      ...prev,
                                      heroSlides: (prev.heroSlides || []).map((s, i) => i === idx ? { ...s, img: url } : s),
                                    }));
                                  } catch {
                                    alert('Ошибка загрузки изображения');
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-black text-blue-900 uppercase tracking-wider">Слайды блока О компании</h4>
                    <button
                      type="button"
                      onClick={() => setSiteForm((prev) => ({
                        ...prev,
                        aboutSlides: [...(prev.aboutSlides || []), { title: '', text: '', imageUrl: '', bullets: [] }],
                      }))}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest"
                    >
                      + Добавить слайд
                    </button>
                  </div>
                  <div className="space-y-4">
                    {(siteForm.aboutSlides || []).map((slide, idx) => (
                      <div key={`about-${idx}`} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-black text-gray-700 uppercase">Слайд #{idx + 1}</div>
                          <button
                            type="button"
                            onClick={() => setSiteForm((prev) => ({
                              ...prev,
                              aboutSlides: (prev.aboutSlides || []).filter((_, i) => i !== idx),
                            }))}
                            className="text-xs font-bold text-red-500"
                          >
                            Удалить
                          </button>
                        </div>
                        <input
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200"
                          value={slide.title || ''}
                          onChange={(e) => setSiteForm((prev) => ({
                            ...prev,
                            aboutSlides: (prev.aboutSlides || []).map((s, i) => i === idx ? { ...s, title: e.target.value } : s),
                          }))}
                          placeholder="Заголовок"
                        />
                        <textarea
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 min-h-[90px]"
                          value={slide.text || ''}
                          onChange={(e) => setSiteForm((prev) => ({
                            ...prev,
                            aboutSlides: (prev.aboutSlides || []).map((s, i) => i === idx ? { ...s, text: e.target.value } : s),
                          }))}
                          placeholder="Текст"
                        />
                        <div className="flex gap-3 items-start">
                          {slide.imageUrl ? (
                            <div className="relative flex-shrink-0 w-24 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                              <img
                                src={normalizeAssetUrl(slide.imageUrl)}
                                alt="preview"
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                              <button
                                type="button"
                                title="Удалить изображение"
                                onClick={() => setSiteForm((prev) => ({
                                  ...prev,
                                  aboutSlides: (prev.aboutSlides || []).map((s, i) => i === idx ? { ...s, imageUrl: '' } : s),
                                }))}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center shadow"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex-shrink-0 w-24 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-2xl">
                              <i className="fas fa-image"></i>
                            </div>
                          )}
                          <div className="flex-grow space-y-2">
                            <input
                              className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-sm"
                              value={slide.imageUrl || ''}
                              onChange={(e) => setSiteForm((prev) => ({
                                ...prev,
                                aboutSlides: (prev.aboutSlides || []).map((s, i) => i === idx ? { ...s, imageUrl: e.target.value } : s),
                              }))}
                              placeholder="URL изображения"
                            />
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">
                              <i className="fas fa-upload"></i> Загрузить файл
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const url = await uploadConstructorImage(file);
                                    setSiteForm((prev) => ({
                                      ...prev,
                                      aboutSlides: (prev.aboutSlides || []).map((s, i) => i === idx ? { ...s, imageUrl: url } : s),
                                    }));
                                  } catch {
                                    alert('Ошибка загрузки изображения');
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        <textarea
                          className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 min-h-[90px]"
                          value={Array.isArray(slide.bullets) ? slide.bullets.join('\n') : ''}
                          onChange={(e) => setSiteForm((prev) => ({
                            ...prev,
                            aboutSlides: (prev.aboutSlides || []).map((s, i) => i === idx
                              ? { ...s, bullets: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }
                              : s),
                          }))}
                          placeholder="Пункты, каждый с новой строки"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row gap-6 justify-between items-center bg-gray-50/50">
              <div className="relative w-full md:w-96">
                <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
                <input 
                  type="text" 
                  placeholder="Быстрый поиск по складу..." 
                  className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={openAddModal}
                  className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-200 transition-all uppercase tracking-widest text-xs hover:bg-blue-700"
                >
                  + Добавить товар
                </button>
                <div className="text-sm font-bold text-blue-900 uppercase tracking-widest">
                  Всего товаров: {totalCount}
                </div>
              </div>
            </div>

            <InvPager />

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] text-gray-400 font-black uppercase tracking-widest border-b border-gray-50">
                    <th className="px-8 py-6">Товар / Категория</th>
                    <th className="px-8 py-6">Цена</th>
                    <th className="px-8 py-6">Статус</th>
                    <th className="px-8 py-6 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invItems.map((product: any) => (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center text-gray-300">
                            <i className="fas fa-image"></i>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-blue-900 line-clamp-1">{product.name}</div>
                            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{product.__catTitle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-gray-700">
                          {product.prices?.retail ? `${product.prices.retail.toLocaleString()} ₸` : (product.prices?.note || '---')}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <button 
                          onClick={() => toggleProductStock(product.id, product.inStock)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${product.inStock ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}
                        >
                          {product.inStock ? 'В наличии' : 'Нет в наличии'}
                        </button>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(product, product.__catTitle)}
                            className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                            title="Редактировать товар"
                          >
                            <i className="fas fa-edit text-xs"></i>
                          </button>
                          <button 
                            onClick={() => deleteProduct(product.id)}
                            className="w-9 h-9 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                            title="Удалить"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {adminCategories.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center text-gray-400 font-medium italic">
                        Каталог пуст. Перейдите во вкладку "Импорт Excel", чтобы загрузить товары.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <InvPager />
          </div>
        )}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsAddOpen(false)}
          />
          <div className="relative w-[min(1000px,92vw)] max-h-[90vh] overflow-y-auto bg-white rounded-[32px] shadow-2xl border border-gray-100">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Добавить товар</div>
                <div className="text-gray-400 font-medium text-sm">Заполните поля и сохраните товар</div>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                title="Закрыть"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={submitAddProduct} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Категория</div>
                  <input
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                    value={addForm.category_title}
                    onChange={(e) => setAddForm({ ...addForm, category_title: e.target.value })}
                    placeholder="Например: Утеплитель"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Наименование</div>
                  <input
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="Название товара"
                  />
                </div>

                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Группа / Бренд</div>
                  <input
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                    value={addForm.brandOrGroup}
                    onChange={(e) => setAddForm({ ...addForm, brandOrGroup: e.target.value })}
                    placeholder="Например: Protan"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Артикул</div>
                  <input
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                    value={addForm.sku}
                    onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                    placeholder="SKU"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Изображения товара (до 3 шт.)</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[0, 1, 2].map((idx) => (
                      <div key={`add-image-${idx}`} className="rounded-2xl border border-gray-200 p-3 bg-gray-50/60">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Картинка {idx + 1}</div>
                        <input
                          className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-xs"
                          value={(addForm.images as string[])[idx] || ''}
                          onChange={(e) => {
                            const images = [...(addForm.images as string[])];
                            images[idx] = e.target.value;
                            const first = filledImages(images)[0] || '';
                            setAddForm({ ...addForm, images, image: first });
                          }}
                          placeholder="/uploads/products/..."
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${addImageUploading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer'}`}>
                            <i className={`fas ${addImageUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {addImageUploading ? '...' : 'Файл'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={addImageUploading}
                              onChange={(e) => {
                                uploadImageForAdd(idx, e.target.files?.[0]);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const images = [...(addForm.images as string[])];
                              images[idx] = '';
                              const first = filledImages(images)[0] || '';
                              setAddForm({ ...addForm, images, image: first });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-600 select-none">
                    <input
                      type="checkbox"
                      checked={addForm.inStock}
                      onChange={(e) => setAddForm({ ...addForm, inStock: e.target.checked })}
                    />
                    В наличии
                  </label>
                </div>
              </div>

              <div className="mt-8">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Описание</div>
                <textarea
                  className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm min-h-[90px]"
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="Описание (необязательно)"
                />
              </div>

              <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50/60 border border-gray-100 rounded-[28px] p-6">
                  <div className="text-sm font-black text-blue-900 uppercase tracking-widest mb-5">Цены</div>
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Розница (₸)</div>
                    <input
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                      value={addForm.prices.retail}
                      onChange={(e) => setAddForm({ ...addForm, prices: { ...addForm.prices, retail: e.target.value } })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="bg-gray-50/60 border border-gray-100 rounded-[28px] p-6">
                  <div className="text-sm font-black text-blue-900 uppercase tracking-widest mb-5">Характеристики (формат Excel)</div>
                  <div className="text-xs text-gray-500 mb-3">Введите строкой: Название: значение, Название: значение, ...</div>
                  <textarea
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm min-h-[160px]"
                    value={addForm.attrsText}
                    onChange={(e) => setAddForm({ ...addForm, attrsText: e.target.value })}
                    placeholder="Монтажный диаметр мм: 110, Высота выпуска мм: 470, Серия: A110Y"
                  />
                </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsEditOpen(false)}
          />
          <div className="relative w-[min(1000px,92vw)] max-h-[90vh] overflow-y-auto bg-white rounded-[32px] shadow-2xl border border-gray-100">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Редактировать товар</div>
                <div className="text-gray-400 font-medium text-sm">Измените поля и сохраните изменения</div>
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2">Категория: {editForm.category_title || '---'}</div>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                title="Закрыть"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <form onSubmit={submitEditProduct} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Наименование</div>
                  <input
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Название товара"
                  />
                </div>

                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Группа / Бренд</div>
                  <input
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                    value={editForm.brandOrGroup}
                    onChange={(e) => setEditForm({ ...editForm, brandOrGroup: e.target.value })}
                    placeholder="Например: Protan"
                  />
                </div>

                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Артикул (SKU)</div>
                  <input
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                    value={editForm.sku}
                    onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                    placeholder="01.001"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Изображения товара (до 3 шт.)</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[0, 1, 2].map((idx) => (
                      <div key={`edit-image-${idx}`} className="rounded-2xl border border-gray-200 p-3 bg-gray-50/60">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Картинка {idx + 1}</div>
                        <input
                          className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-xs"
                          value={(editForm.images as string[])[idx] || ''}
                          onChange={(e) => {
                            const images = [...(editForm.images as string[])];
                            images[idx] = e.target.value;
                            const first = filledImages(images)[0] || '';
                            setEditForm({ ...editForm, images, image: first });
                          }}
                          placeholder="/uploads/products/..."
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest ${editImageUploading ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50 cursor-pointer'}`}>
                            <i className={`fas ${editImageUploading ? 'fa-spinner fa-spin' : 'fa-upload'}`}></i>
                            {editImageUploading ? '...' : 'Файл'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={editImageUploading}
                              onChange={(e) => {
                                uploadImageForEdit(idx, e.target.files?.[0]);
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const images = [...(editForm.images as string[])];
                              images[idx] = '';
                              const first = filledImages(images)[0] || '';
                              setEditForm({ ...editForm, images, image: first });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-100"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Описание</div>
                  <textarea
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm min-h-[110px]"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Описание товара"
                  />
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 text-sm font-bold text-gray-600 select-none">
                    <input
                      type="checkbox"
                      checked={editForm.inStock}
                      onChange={(e) => setEditForm({ ...editForm, inStock: e.target.checked })}
                    />
                    В наличии
                  </label>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50/60 border border-gray-100 rounded-[28px] p-6">
                  <div className="text-sm font-black text-blue-900 uppercase tracking-widest mb-5">Цены</div>
                  <div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Розница (₸)</div>
                    <input
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                      value={editForm.prices.retail}
                      onChange={(e) => setEditForm({ ...editForm, prices: { ...editForm.prices, retail: e.target.value } })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="bg-gray-50/60 border border-gray-100 rounded-[28px] p-6">
                  <div className="text-sm font-black text-blue-900 uppercase tracking-widest mb-5">Характеристики (формат Excel)</div>
                  <div className="text-xs text-gray-500 mb-3">Введите строкой: Название: значение, Название: значение, ...</div>
                  <textarea
                    className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm min-h-[160px]"
                    value={editForm.attrsText}
                    onChange={(e) => setEditForm({ ...editForm, attrsText: e.target.value })}
                    placeholder="Монтажный диаметр мм: 110, Высота выпуска мм: 470, Серия: A110Y"
                  />
                </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row gap-4 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importResult ? (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" onClick={() => setImportResult(null)}>
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${importResult.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                <i className={`fas ${importResult.type === 'success' ? 'fa-check' : 'fa-exclamation-triangle'}`}></i>
              </div>
              <div>
                <div className="text-xl font-black text-blue-900 uppercase tracking-tight leading-tight">{importResult.title}</div>
                <div className="text-sm text-gray-500 mt-2 leading-relaxed">{importResult.details}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className={`w-full py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${importResult.type === 'success' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminDashboard;
