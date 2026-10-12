import { LIKHA_URL } from '../../env.js';
import { getLikhaAdminToken } from '../client.js';

export function formatLikhaModule(m: any, items: any[] = [], comments: any[] = []): any {
  return {
    id: m.id,
    courseId: m.course_id,
    title: m.title,
    order: m.order ?? 0,
    published: Boolean(m.published),
    prerequisiteModuleId: m.prerequisite_module_id || null,
    authorId: m.author_id || null,
    authorName: m.author_name || null,
    items: items.map(formatLikhaModuleItem),
    comments: comments.map(formatLikhaModuleComment),
  };
}

export function formatLikhaModuleItem(item: any): any {
  return {
    id: item.id,
    moduleId: item.module_id,
    title: item.title,
    type: item.type,
    published: Boolean(item.published),
    required: Boolean(item.required),
    content: item.content || null,
    url: item.url || null,
    duration: item.duration || null,
    points: item.points ?? null,
    dueDate: item.due_date || null,
    order: item.order ?? 0,
  };
}

export function formatLikhaModuleComment(c: any): any {
  let likes = c.likes;
  if (typeof likes === 'string') {
    try { likes = JSON.parse(likes); } catch { likes = []; }
  }
  return {
    id: c.id,
    moduleId: c.module_id,
    authorId: c.author_id,
    authorName: c.author_name,
    content: c.content,
    parentId: c.parent_id || null,
    createdAt: c.created_at,
    likes: Array.isArray(likes) ? likes : [],
  };
}

export async function getCourseModules(courseId: string): Promise<any[]> {
  const token = await getLikhaAdminToken();
  const headers = { Authorization: `Bearer ${token}` };

  const [modsRes, itemsRes, commentsRes] = await Promise.all([
    fetch(`${LIKHA_URL}/items/modules?filter[course_id][_eq]=${encodeURIComponent(courseId)}&sort=order`, { headers }),
    fetch(`${LIKHA_URL}/items/module_items?limit=500`, { headers }),
    fetch(`${LIKHA_URL}/items/module_comments?limit=500&sort=created_at`, { headers }),
  ]);

  if (!modsRes.ok) return [];
  const modsJson = (await modsRes.json()) as any;
  const itemsJson = itemsRes.ok ? ((await itemsRes.json()) as any) : { data: [] };
  const commentsJson = commentsRes.ok ? ((await commentsRes.json()) as any) : { data: [] };

  const allItems = itemsJson.data || [];
  const allComments = commentsJson.data || [];

  return (modsJson.data || []).map((m: any) => {
    const mItems = allItems.filter((i: any) => i.module_id === m.id);
    const mComments = allComments.filter((c: any) => c.module_id === m.id);
    return formatLikhaModule(m, mItems, mComments);
  });
}

export async function createModule(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `mod-${Date.now().toString(36)}`,
    course_id: data.courseId,
    title: data.title,
    order: data.order ?? 0,
    published: Boolean(data.published),
    prerequisite_module_id: data.prerequisiteModuleId || null,
    author_id: data.authorId || null,
    author_name: data.authorName || null,
  };

  const res = await fetch(`${LIKHA_URL}/items/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaModule(json.data, [], []);
}

export async function updateModule(id: string, updates: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body: any = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.order !== undefined) body.order = updates.order;
  if (updates.published !== undefined) body.published = updates.published;
  if (updates.prerequisiteModuleId !== undefined) body.prerequisite_module_id = updates.prerequisiteModuleId;

  const res = await fetch(`${LIKHA_URL}/items/modules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaModule(json.data);
}

export async function deleteModule(id: string): Promise<boolean> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/modules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function addModuleItem(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `mi-${Date.now().toString(36)}`,
    module_id: data.moduleId,
    title: data.title,
    type: data.type || 'page',
    published: data.published ?? true,
    required: data.required ?? false,
    content: data.content || null,
    url: data.url || null,
    duration: data.duration || null,
    points: data.points ?? null,
    due_date: data.dueDate || null,
    order: data.order ?? 0,
  };

  const res = await fetch(`${LIKHA_URL}/items/module_items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaModuleItem(json.data);
}

export async function updateModuleItem(id: string, updates: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body: any = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.type !== undefined) body.type = updates.type;
  if (updates.published !== undefined) body.published = updates.published;
  if (updates.required !== undefined) body.required = updates.required;
  if (updates.content !== undefined) body.content = updates.content;
  if (updates.url !== undefined) body.url = updates.url;
  if (updates.points !== undefined) body.points = updates.points;
  if (updates.order !== undefined) body.order = updates.order;
  if (updates.moduleId !== undefined) body.module_id = updates.moduleId;

  const res = await fetch(`${LIKHA_URL}/items/module_items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaModuleItem(json.data);
}

export async function deleteModuleItem(id: string): Promise<boolean> {
  const token = await getLikhaAdminToken();
  const res = await fetch(`${LIKHA_URL}/items/module_items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function addModuleComment(data: any): Promise<any> {
  const token = await getLikhaAdminToken();
  const body = {
    id: data.id || `mc-${Date.now().toString(36)}`,
    module_id: data.moduleId,
    author_id: data.authorId,
    author_name: data.authorName,
    content: data.content,
    parent_id: data.parentId || null,
    created_at: new Date().toISOString(),
    likes: [],
  };

  const res = await fetch(`${LIKHA_URL}/items/module_comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as any;
  return formatLikhaModuleComment(json.data);
}
