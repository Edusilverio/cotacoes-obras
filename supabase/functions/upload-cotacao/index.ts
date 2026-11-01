// =============================================================================
// EDGE FUNCTION: upload-cotacao (v18.12)
// v18.8 : código repetido sem dedup, casa por ordem.
// v18.9 : quantitativo híbrido (Material/MO/unidade); norm sem pontuação.
// v18.10: excluir+reenviar vira R00 (correcao, nao revisao nova).
// v18.11: R08 — etapas com código de LETRA (CUSTOS DIRETOS/INDIRETOS) viram
//         seções (itens numericos aninham embaixo -> subtotal por etapa). Linhas
//         de total/summary (TOTAL CUSTOS, VALOR DAS OBRAS, VALOR TOTAL) ignoradas.
//         BDI extraído da planilha (linha TAXA DE BDI) e salvo na empresa.
// v18.12: R08(rev) — só marca empresa "entregue" se salvou >=1 proposta (evita
//         "entregue" com 0 propostas que fazia o modal avisar "já enviou POR").
// v18.13: R08(rev) — subtotal-header com código repetido (ex: Laje "1.5.4" cabeçalho
//         + "1.5.4" item) faz merge, pra o valor entrar no somatório da etapa.
// v18.14: R08(rev) — BDI salvo com precisão (6 casas) pra o total bater com a proposta.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

interface ParsedItem { codigo_item: string; macro?: string; descricao?: string; unidade?: string; quantidade_projeto?: number; parent_codigo?: string; nivel: number; ordem: number; tipo?: string; eh_expansivel: boolean; }
interface ParsedQuestionamento { categoria?: string; numero?: string; pergunta: string; ordem: number; }
interface ParsedVal { codigo_item: string; macro?: string; quantidade_proponente?: number; preco_unit_material?: number; preco_unit_mao_obra?: number; preco_unitario?: number; observacao?: string; }
interface ParsedResp { categoria?: string; numero?: string; resposta: string; }

function cellRC(ws: XLSX.WorkSheet, r: number, c: number): unknown { const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 }); const cell = ws[addr]; return cell ? (cell.v ?? null) : null; }
function sRC(ws: XLSX.WorkSheet, r: number, c: number): string | null { const v = cellRC(ws, r, c); if (v === null || v === undefined) return null; return String(v).trim(); }
function nRC(ws: XLSX.WorkSheet, r: number, c: number): number | null { const v = cellRC(ws, r, c); return typeof v === "number" ? v : null; }
function getCellString(ws: XLSX.WorkSheet, address: string): string | null { const cell = ws[address]; if (!cell) return null; const v = cell.v; if (v === null || v === undefined) return null; return String(v).trim(); }
function getCellNumber(ws: XLSX.WorkSheet, address: string): number | null { const cell = ws[address]; if (!cell) return null; const v = cell.v; return typeof v === "number" ? v : null; }
function norm(s: unknown): string { let t = String(s ?? ""); t = t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase(); t = t.replace(/[^A-Z0-9 ]/g, " "); return t.replace(/\s+/g, " ").trim(); }
function chave(macro: string | undefined, codigo: string): string { return `${macro ?? ""}|${codigo}`; }
function ehLinhaInstrucao(a: string | null, b: string | null): boolean { if (a) return false; if (!b) return false; const t = b.toUpperCase(); return (t.includes("INSTRUÇÕES PARA MONTAGEM") || t.includes("INSTRUCOES PARA MONTAGEM") || t.includes("MANTER A SEQUENCIA") || t.includes("MANTER A SEQUÊNCIA")); }
function ehLinhaBdi(macroAtual: string | undefined, a: string | null, b: string | null): boolean { if (macroAtual !== "C") return false; if (a) return false; if (!b) return false; const t = b.toUpperCase(); if (t.startsWith("TOTAL") || t.includes("PORCENTAGEM DE MATERIAL")) return false; return true; }

const HEAD: Record<string, string[]> = { codigo: ["ITEM", "CODIGO", "COD"], descricao: ["DESCRICAO", "DISCRIMINACAO"], unidade: ["UNIDADE", "UNID", "UND", "UN"], quantidade: ["QUANT", "QTD", "QUANTIDADE"], material: ["PRECO UN MAT", "PRECO UNIT MAT", "PRECO UNITARIO MAT", "MATERIAL"], mao_obra: ["PRECO UN MO", "PRECO UNIT MO", "PRECO UNITARIO MO", "MAO DE OBRA", "MAO OBRA"], preco_unit: ["PRECO UNIT", "PRECO UNITARIO", "VALOR UNIT"], preco_total: ["PRECO TOTAL", "VALOR TOTAL"], obs: ["OBSERV", "OBS"] };
function matchCol(h: string): string | null { for (const key of Object.keys(HEAD)) for (const a of HEAD[key]) if (h === a || h.startsWith(a)) return key; return null; }
function detectaQuant(ws: XLSX.WorkSheet): { headerRow: number; cols: Record<string, number> } | null { if (!ws || !ws["!ref"]) return null; for (let r = 1; r <= 25; r++) { const cols: Record<string, number> = {}; for (let c = 1; c <= 14; c++) { const k = matchCol(norm(sRC(ws, r, c))); if (k && !(k in cols)) cols[k] = c; } if ("codigo" in cols && "descricao" in cols && ("preco_unit" in cols || "quantidade" in cols || "material" in cols)) return { headerRow: r, cols }; } return null; }
function detectarTipo(wb: XLSX.WorkBook): { tipo: "por" | "cot" | "quant" | null; ws?: XLSX.WorkSheet; det?: any } { const s = wb.SheetNames; if (s.includes("PLANILHA") && s.includes("RESUMO") && s.includes("CONDIÇÕES GERAIS")) return { tipo: "por" }; if (s.includes("Cadastro") && s.includes("Propostas Originais") && s.includes("Questionamentos")) return { tipo: "cot" }; for (const sh of s) { const ws = wb.Sheets[sh]; const det = detectaQuant(ws); if (det) return { tipo: "quant", ws, det }; } return { tipo: null }; }

// v18.11: etapas (código letra) viram seções; itens numéricos aninham; extrai BDI.
function parseQuant(ws: XLSX.WorkSheet, headerRow: number, cols: Record<string, number>): { estrutura: ParsedItem[]; valores: ParsedVal[]; bdi: number | null } {
  const estrutura: ParsedItem[] = []; const valores: ParsedVal[] = []; const range = XLSX.utils.decode_range(ws["!ref"]!); let ordem = 0;
  const temSplit = ("material" in cols) || ("mao_obra" in cols);
  let bdi: number | null = null; let macroAtivo = false;
  const col = (r: number, key: string, num = false) => { const c = cols[key]; if (!c) return null; return num ? nRC(ws, r, c) : sRC(ws, r, c); };
  for (let r = headerRow + 1; r <= range.e.r + 1; r++) {
    try {
      let cod = col(r, "codigo") as string | null; const desc = col(r, "descricao") as string | null; const descU = norm(desc); const codT = cod ? String(cod).trim() : "";
      if (descU.includes("BDI")) { const taxa = col(r, "preco_unit", true) as number | null; if (typeof taxa === "number") bdi = taxa < 1 ? taxa * 100 : taxa; continue; }
      if (!codT && descU.includes("TOTAL")) continue;
      if (/^[A-Z]$/.test(codT) && (descU.includes("VALOR") || descU.includes("TOTAL"))) continue;
      if (/^[A-Z]$/.test(codT) && desc) { ordem++; estrutura.push({ codigo_item: codT, macro: undefined, descricao: desc, unidade: undefined, quantidade_projeto: undefined, parent_codigo: undefined, nivel: 0, ordem, tipo: "secao", eh_expansivel: true }); macroAtivo = true; continue; }
      if (!cod) continue; cod = codT.replace(/\.$/, ""); if (!/^\d+(\.\d+)*$/.test(cod)) continue;
      const unid = col(r, "unidade") as string | null; const q = col(r, "quantidade", true) as number | null;
      const mat = col(r, "material", true) as number | null; const mo = col(r, "mao_obra", true) as number | null; const puTot = col(r, "preco_unit", true) as number | null; const obs = col(r, "obs") as string | null;
      const temPreco = ((puTot ?? 0) !== 0) || ((mat ?? 0) !== 0) || ((mo ?? 0) !== 0);
      // v18.13: subtotal-header com MESMO código do item seguinte (ex: Laje "1.5.4" cabeçalho + "1.5.4" item).
      // Sem isso o valor casava na linha-seção e ficava fora do somatório da etapa. Faz merge na seção.
      if (temPreco && estrutura.length > 0) {
        const prev = estrutura[estrutura.length - 1];
        if (prev.codigo_item === cod && prev.tipo === "secao" && prev.eh_expansivel) {
          prev.tipo = "item"; prev.eh_expansivel = false;
          if (unid != null) prev.unidade = unid; if (q != null) prev.quantidade_projeto = q;
          const val: ParsedVal = { codigo_item: cod, macro: undefined, quantidade_proponente: q ?? undefined, observacao: obs ?? undefined };
          if (temSplit) { val.preco_unit_material = mat ?? undefined; val.preco_unit_mao_obra = mo ?? undefined; } else { val.preco_unitario = puTot ?? undefined; }
          valores.push(val);
          continue;
        }
      }
      const segs = cod.split("."); const nivel = (segs.length - 1) + (macroAtivo ? 1 : 0); const parent = segs.length > 1 ? segs.slice(0, -1).join(".") : undefined; ordem++;
      estrutura.push({ codigo_item: cod, macro: undefined, descricao: desc ?? undefined, unidade: unid ?? undefined, quantidade_projeto: q ?? undefined, parent_codigo: parent, nivel, ordem, tipo: temPreco ? "item" : "secao", eh_expansivel: !temPreco });
      const temValor = temPreco || q !== null || !!obs;
      if (temValor) { const val: ParsedVal = { codigo_item: cod, macro: undefined, quantidade_proponente: q ?? undefined, observacao: obs ?? undefined }; if (temSplit) { val.preco_unit_material = mat ?? undefined; val.preco_unit_mao_obra = mo ?? undefined; } else { val.preco_unitario = puTot ?? undefined; } valores.push(val); }
    } catch (e) { console.warn(`[QUANT] linha ${r} ignorada:`, (e as Error).message); }
  }
  console.log(`[QUANT] estrutura=${estrutura.length} valores=${valores.length} split=${temSplit} bdi=${bdi}`); return { estrutura, valores, bdi };
}
function parsePorPlanilhaVal(wb: XLSX.WorkBook): ParsedVal[] {
  const itens: ParsedVal[] = []; const ws = wb.Sheets["PLANILHA"]; if (!ws || !ws["!ref"]) return itens; const range = XLSX.utils.decode_range(ws["!ref"]); let macroAtual: string | undefined; let bdiSeq = 0;
  for (let r = 7; r <= range.e.r; r++) { try { const a = getCellString(ws, `A${r + 1}`); const b = getCellString(ws, `B${r + 1}`); if (ehLinhaInstrucao(a, b)) break;
    if (!a) { if (ehLinhaBdi(macroAtual, a, b)) { const e = getCellNumber(ws, `E${r + 1}`); const cc = getCellString(ws, `C${r + 1}`); if (e !== null || cc === "%") { bdiSeq++; itens.push({ codigo_item: `C.${bdiSeq}`, macro: "C", quantidade_proponente: e ?? undefined }); } } continue; }
    if (/^[A-Z]$/.test(a)) { macroAtual = a; if (a === "C") bdiSeq = 0; continue; }
    const e = getCellNumber(ws, `E${r + 1}`); const f = getCellNumber(ws, `F${r + 1}`); const gg = getCellNumber(ws, `G${r + 1}`); const k = getCellString(ws, `K${r + 1}`); if (e === null && f === null && gg === null && !k) continue;
    itens.push({ codigo_item: a.trim(), macro: macroAtual, quantidade_proponente: e ?? undefined, preco_unit_material: f ?? undefined, preco_unit_mao_obra: gg ?? undefined, observacao: k ?? undefined }); } catch (er) { console.warn(`[POR val] linha ${r} ignorada:`, (er as Error).message); } }
  return itens;
}
function parsePorEstrutura(wb: XLSX.WorkBook): ParsedItem[] {
  const ws = wb.Sheets["PLANILHA"]; if (!ws || !ws["!ref"]) return []; const range = XLSX.utils.decode_range(ws["!ref"]);
  type Raw = { macro?: string; codigo: string; descricao?: string; unidade?: string; qtd?: number; tipo: string; ehExp: boolean; }; const raws: Raw[] = []; const existentes = new Set<string>(); let macroAtual: string | undefined; let bdiSeq = 0;
  for (let r = 7; r <= range.e.r; r++) { try { const a = getCellString(ws, `A${r + 1}`); const b = getCellString(ws, `B${r + 1}`); const c = getCellString(ws, `C${r + 1}`); const d = getCellNumber(ws, `D${r + 1}`); if (ehLinhaInstrucao(a, b)) break;
    if (!a) { if (ehLinhaBdi(macroAtual, a, b)) { const e = getCellNumber(ws, `E${r + 1}`); if (e !== null || c === "%") { bdiSeq++; const codigo = `C.${bdiSeq}`; const k = chave("C", codigo); if (!existentes.has(k)) { existentes.add(k); raws.push({ macro: "C", codigo, descricao: b ?? undefined, unidade: c ?? "%", qtd: undefined, tipo: "bdi", ehExp: false }); } } } continue; }
    const codigo = a.trim(); let tipo = "item"; let ehExp = false; const segs = codigo.split("."); if (/^[A-Z]$/.test(codigo)) { macroAtual = codigo; tipo = "macro"; ehExp = true; if (codigo === "C") bdiSeq = 0; } else if (b && b.trim().toUpperCase() === "OMISSOS") { tipo = "omissos"; ehExp = true; } else if (segs.length === 2 && segs[1] === "0") { tipo = "secao"; ehExp = true; } else if (segs.length >= 4) { tipo = "subitem_omissos"; }
    const k = chave(macroAtual, codigo); if (existentes.has(k)) continue; existentes.add(k); raws.push({ macro: macroAtual, codigo, descricao: b ?? undefined, unidade: c ?? undefined, qtd: d ?? undefined, tipo, ehExp }); } catch (er) { console.warn(`[POR estr] linha ${r} ignorada:`, (er as Error).message); } }
  const resolveParent = (macro: string | undefined, codigo: string, tipo: string): string | undefined => { if (tipo === "macro") return undefined; const segs = codigo.split("."); if (segs.length <= 1) return macro; const strip = segs.slice(0, -1).join("."); if (existentes.has(chave(macro, strip))) return strip; const cs = `${strip}.0`; if (existentes.has(chave(macro, cs))) return cs; return macro; };
  const parentDe = new Map<string, string | undefined>(); for (const rw of raws) parentDe.set(chave(rw.macro, rw.codigo), resolveParent(rw.macro, rw.codigo, rw.tipo));
  const calcNivel = (macro: string | undefined, codigo: string): number => { let n = 0; let cur = codigo; const seen = new Set<string>(); while (n < 15) { const k = chave(macro, cur); if (seen.has(k)) break; seen.add(k); const p = parentDe.get(k); if (p === undefined) break; n++; cur = p; } return n; };
  const itens: ParsedItem[] = []; let ordem = 0; for (const rw of raws) { ordem++; itens.push({ codigo_item: rw.codigo, macro: rw.macro, descricao: rw.descricao, unidade: rw.unidade, quantidade_projeto: rw.qtd, parent_codigo: parentDe.get(chave(rw.macro, rw.codigo)), nivel: calcNivel(rw.macro, rw.codigo), ordem, tipo: rw.tipo, eh_expansivel: rw.ehExp }); } return itens;
}
function parsePorRespostas(wb: XLSX.WorkBook): ParsedResp[] { const respostas: ParsedResp[] = []; const ws = wb.Sheets["CONDIÇÕES GERAIS"]; if (!ws || !ws["!ref"]) return respostas; const range = XLSX.utils.decode_range(ws["!ref"]); let cat: string | undefined; for (let r = 5; r <= range.e.r; r++) { try { const a = getCellString(ws, `A${r + 1}`); const b = getCellString(ws, `B${r + 1}`); const f = getCellString(ws, `F${r + 1}`); if (a && /^[A-Z]$/.test(a.trim()) && b && b.length > 2) { cat = b.trim(); continue; } if (b && b.length > 5 && f && f.trim().length > 0) respostas.push({ categoria: cat, numero: a ?? undefined, resposta: f.trim() }); } catch (er) { console.warn(`[POR resp] linha ${r} ignorada:`, (er as Error).message); } } return respostas; }
function parsePorQuest(wb: XLSX.WorkBook): ParsedQuestionamento[] { const qs: ParsedQuestionamento[] = []; const ws = wb.Sheets["CONDIÇÕES GERAIS"]; if (!ws || !ws["!ref"]) return qs; const range = XLSX.utils.decode_range(ws["!ref"]); let ordem = 0; let cat: string | undefined; for (let r = 5; r <= range.e.r; r++) { try { const a = getCellString(ws, `A${r + 1}`); const b = getCellString(ws, `B${r + 1}`); if (a && /^[A-Z]$/.test(a.trim()) && b && b.length > 2) { cat = b.trim(); continue; } if (b && b.length > 5) { ordem++; qs.push({ categoria: cat, numero: a ?? undefined, pergunta: b, ordem }); } } catch (er) { console.warn(`[POR quest] linha ${r} ignorada:`, (er as Error).message); } } return qs; }

async function handleUpload(a: { estrutura: ParsedItem[]; valores: ParsedVal[]; respostas: ParsedResp[]; quests: ParsedQuestionamento[]; bdi: number | null; layout: string; fileName: string; fileSize: number; fileBuffer: ArrayBuffer; projetoId: string; numeroPacote: number; empresaIdExistente: string | null; empresaNomeNova: string | null; supabaseAdmin: any; userId: string; }): Promise<any> {
  const { estrutura, valores, respostas, quests, bdi, layout, fileName, fileSize, fileBuffer, projetoId, numeroPacote, empresaIdExistente, empresaNomeNova, supabaseAdmin, userId } = a;
  const { data: cotacaoAtiva, error: errCot } = await supabaseAdmin.from("cotacoes").select("id").eq("projeto_id", projetoId).eq("numero_pacote", numeroPacote).eq("status", "ativa").maybeSingle();
  if (errCot) throw new Error(`Buscar cotacao ativa: ${errCot.message}`); if (!cotacaoAtiva) throw new Error(`Nenhuma cotação ativa no pacote ${numeroPacote}. Crie o pacote antes de enviar propostas.`); const cotacaoId = cotacaoAtiva.id;
  let empresaId: string; let empresaCriada = false; let empresaNumeroRevisao = 0;
  if (empresaIdExistente) {
    const { data: emp, error: e } = await supabaseAdmin.from("empresas").select("id, numero_revisao").eq("id", empresaIdExistente).eq("cotacao_id", cotacaoId).single();
    if (e || !emp) throw new Error(`Empresa não encontrada`);
    empresaId = emp.id;
    const { count: propsAtuais } = await supabaseAdmin.from("item_propostas").select("item_id", { count: "exact", head: true }).eq("empresa_id", emp.id);
    empresaNumeroRevisao = (propsAtuais ?? 0) === 0 ? 0 : (emp.numero_revisao ?? 0) + 1;
  }
  else if (empresaNomeNova) { const { data: emps } = await supabaseAdmin.from("empresas").select("indice").eq("cotacao_id", cotacaoId).order("indice", { ascending: false }).limit(1); const idx = (emps && emps.length > 0 ? emps[0].indice : 0) + 1; const { data: nova, error: e2 } = await supabaseAdmin.from("empresas").insert({ cotacao_id: cotacaoId, indice: idx, letra_id: String.fromCharCode(64 + idx), nome: empresaNomeNova, numero_revisao: 0 }).select("id").single(); if (e2) throw new Error(`Inserir empresa: ${e2.message}`); empresaId = nova.id; empresaCriada = true; }
  else throw new Error("Informe empresa_id ou empresa_nome_nova");

  const { count: itensExist } = await supabaseAdmin.from("itens").select("id", { count: "exact", head: true }).eq("cotacao_id", cotacaoId); const ehPrimeira = (itensExist ?? 0) === 0;
  if (ehPrimeira && estrutura.length > 0) { const B = 200; for (let i = 0; i < estrutura.length; i += B) { const lote = estrutura.slice(i, i + B).map((it) => ({ cotacao_id: cotacaoId, ...it })); const { error: e } = await supabaseAdmin.from("itens").insert(lote); if (e) throw new Error(`Inserir itens ${i}: ${e.message}`); } if (quests.length > 0) { const { error: e } = await supabaseAdmin.from("questionamentos").insert(quests.map((q) => ({ cotacao_id: cotacaoId, ...q }))); if (e) throw new Error(`Inserir quest: ${e.message}`); } }

  const { data: itensCot } = await supabaseAdmin.from("itens").select("id, codigo_item, macro, ordem").eq("cotacao_id", cotacaoId);
  const itensOrd = (itensCot ?? []).slice().sort((x: any, y: any) => (x.ordem ?? 0) - (y.ordem ?? 0));
  const porChave = new Map<string, string[]>(); const porCod = new Map<string, string[]>();
  for (const it of itensOrd) { const kc = chave(it.macro ?? undefined, it.codigo_item); if (!porChave.has(kc)) porChave.set(kc, []); porChave.get(kc)!.push(it.id); if (!porCod.has(it.codigo_item)) porCod.set(it.codigo_item, []); porCod.get(it.codigo_item)!.push(it.id); }
  const usoChave = new Map<string, number>(); const usoCod = new Map<string, number>();
  const acharItem = (v: ParsedVal): string | undefined => {
    const kc = chave(v.macro, v.codigo_item); const lc = porChave.get(kc);
    if (lc && lc.length) { const i = usoChave.get(kc) ?? 0; if (i < lc.length) { usoChave.set(kc, i + 1); return lc[i]; } }
    const lcod = porCod.get(v.codigo_item);
    if (lcod && lcod.length) { const i = usoCod.get(v.codigo_item) ?? 0; if (i < lcod.length) { usoCod.set(v.codigo_item, i + 1); return lcod[i]; } }
    return undefined;
  };

  const propostas: any[] = []; const naoEnc = new Set<string>();
  for (const v of valores) { const id = acharItem(v); if (!id) { naoEnc.add(chave(v.macro, v.codigo_item)); continue; } propostas.push({ item_id: id, empresa_id: empresaId, quantidade_proponente: v.quantidade_proponente, preco_unit_material: v.preco_unit_material, preco_unit_mao_obra: v.preco_unit_mao_obra, preco_unitario: v.preco_unitario, observacao_proponente: v.observacao }); }

  if (!ehPrimeira && naoEnc.size > 0) {
    const extras = valores.filter((v) => naoEnc.has(chave(v.macro, v.codigo_item)));
    const { data: ultOrdem } = await supabaseAdmin.from("itens").select("ordem").eq("cotacao_id", cotacaoId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    let prox = (ultOrdem?.ordem ?? 0) + 1; const mapaEstr = new Map(estrutura.map((e) => [chave(e.macro, e.codigo_item), e]));
    const novos = extras.map((ex) => { const info = mapaEstr.get(chave(ex.macro, ex.codigo_item)); return { cotacao_id: cotacaoId, codigo_item: ex.codigo_item, macro: ex.macro, descricao: info?.descricao ?? `Omisso ${ex.codigo_item}`, unidade: info?.unidade, quantidade_projeto: ex.quantidade_proponente, parent_codigo: info?.parent_codigo, nivel: info?.nivel ?? 0, ordem: prox++, tipo: "subitem_omissos", eh_expansivel: false, origem_omisso: true, empresa_origem_id: empresaId, status_omisso: "pendente_aprovacao" }; });
    if (novos.length > 0) { const { data: ins, error: eo } = await supabaseAdmin.from("itens").insert(novos).select("id, codigo_item, macro, ordem"); if (eo) console.error("[omissos]", eo.message); else { const usoOm = new Map<string, number>(); for (const ex of extras) { const cand = (ins ?? []).filter((om: any) => chave(om.macro ?? undefined, om.codigo_item) === chave(ex.macro, ex.codigo_item)); const i = usoOm.get(chave(ex.macro, ex.codigo_item)) ?? 0; const om = cand[i]; if (!om) continue; usoOm.set(chave(ex.macro, ex.codigo_item), i + 1); propostas.push({ item_id: om.id, empresa_id: empresaId, quantidade_proponente: ex.quantidade_proponente, preco_unit_material: ex.preco_unit_material, preco_unit_mao_obra: ex.preco_unit_mao_obra, preco_unitario: ex.preco_unitario, observacao_proponente: ex.observacao }); } } }
  }

  const unicas: any[] = []; const vistos = new Set<string>(); for (const p of propostas) { if (vistos.has(p.item_id)) continue; vistos.add(p.item_id); unicas.push(p); }
  if (empresaNumeroRevisao > 0) { const { data: atuais } = await supabaseAdmin.from("item_propostas").select("item_id,empresa_id,quantidade_proponente,preco_unit_material,preco_unit_mao_obra,preco_unitario,observacao_proponente").eq("empresa_id", empresaId); if (atuais && atuais.length > 0) { const arq = atuais.map((x: any) => ({ ...x, numero_revisao: empresaNumeroRevisao - 1 })); const { error: e } = await supabaseAdmin.from("item_propostas_historico").insert(arq); if (e) console.error("[hist]", e.message); } }
  if (unicas.length > 0) { const { error: e } = await supabaseAdmin.from("item_propostas").upsert(unicas, { onConflict: "item_id,empresa_id" }); if (e) throw new Error(`Upsert propostas: ${e.message}`); }

  if (respostas.length > 0) { const { data: qc } = await supabaseAdmin.from("questionamentos").select("id, numero, categoria").eq("cotacao_id", cotacaoId); const mq = new Map<string, string>(); for (const q of qc ?? []) mq.set(`${q.categoria ?? ""}|${q.numero ?? ""}`, q.id); const up: any[] = []; const vq = new Set<string>(); for (const r of respostas) { const qid = mq.get(`${r.categoria ?? ""}|${r.numero ?? ""}`); if (!qid || vq.has(qid)) continue; vq.add(qid); up.push({ questionamento_id: qid, empresa_id: empresaId, resposta: r.resposta }); } if (up.length > 0) { const { error: e } = await supabaseAdmin.from("questionamento_respostas").upsert(up, { onConflict: "questionamento_id,empresa_id" }); if (e) throw new Error(`Upsert respostas: ${e.message}`); } }

  // Só marca "entregue" se realmente salvou proposta; evita empresa "entregue" com 0 propostas
  // (que fazia o modal avisar "já enviou POR" num primeiro upload). Nunca rebaixa status aqui.
  const updEmp: any = { numero_revisao: empresaNumeroRevisao };
  if (unicas.length > 0) updEmp.status = "entregue";
  // Guarda o BDI com precisão (6 casas) para o total bater com a proposta; a tela exibe arredondado.
  if (typeof bdi === "number" && isFinite(bdi)) updEmp.bdi_percentual = Math.round(bdi * 1e6) / 1e6;
  await supabaseAdmin.from("empresas").update(updEmp).eq("id", empresaId);
  const ts = Date.now(); const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `${projetoId}/por/${empresaId}-r${empresaNumeroRevisao}-${ts}-${safe}`;
  const { error: es } = await supabaseAdmin.storage.from((Deno.env.get("CO_STORAGE_PREFIX") ?? "") + "uploads").upload(path, fileBuffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: false }); if (es) console.error("[storage]", es.message);
  await supabaseAdmin.from("uploads_historico").insert({ cotacao_id: cotacaoId, tipo: "por_proponente", empresa_id: empresaId, arquivo_path: path, arquivo_nome: fileName, tamanho_bytes: fileSize, resumo_processamento: { layout, empresa_criada: empresaCriada, empresa_revisao: empresaNumeroRevisao, itens_atualizados: unicas.length, itens_nao_encontrados: naoEnc.size, bdi }, upado_por: userId, upado_em: new Date().toISOString() });
  return { sucesso: true, layout, cotacao_id: cotacaoId, empresa_id: empresaId, empresa_criada: empresaCriada, revisao: empresaNumeroRevisao, bdi, resumo: { itens_atualizados: unicas.length, itens_nao_encontrados: naoEnc.size } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization"); if (!authHeader) return json({ erro: "Authorization header ausente" }, 401);
    const URL = Deno.env.get("SUPABASE_URL")!; const ANON = Deno.env.get("SUPABASE_ANON_KEY")!; const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", ""); const supaUser = createClient(URL, ANON); const { data: { user }, error: ue } = await supaUser.auth.getUser(token); if (ue || !user) return json({ erro: "Sessão inválida" }, 401);
    const supabaseAdmin = createClient(URL, SVC, { db: { schema: Deno.env.get("CO_DB_SCHEMA") ?? "public" } }); const { data: perfil } = await supabaseAdmin.from("perfis").select("papel, organizacao_id").eq("id", user.id).single(); if (!perfil || !["admin_nexo", "editor_nexo"].includes(perfil.papel)) return json({ erro: "Sem permissão para upload" }, 403);
    const fd = await req.formData(); const file = fd.get("file") as File | null; const projetoId = fd.get("projeto_id") as string | null; const empresaIdParam = fd.get("empresa_id") as string | null; const empresaNomeNovaParam = fd.get("empresa_nome_nova") as string | null; const numeroPacoteParam = fd.get("numero_pacote") as string | null; const previewFlag = String(fd.get("preview") ?? "") === "true";
    if (!file || !projetoId) return json({ erro: "file e projeto_id são obrigatórios" }, 400); if (!file.name.toLowerCase().endsWith(".xlsx")) return json({ erro: "Apenas arquivos .xlsx" }, 400);
    const numeroPacote = numeroPacoteParam ? parseInt(numeroPacoteParam) : 1;
    const { data: projeto } = await supabaseAdmin.from("projetos").select("id, organizacao_id").eq("id", projetoId).single(); if (!projeto || projeto.organizacao_id !== perfil.organizacao_id) return json({ erro: "Projeto sem permissão" }, 403);
    const buffer = await file.arrayBuffer();
    let wb: XLSX.WorkBook;
    try { wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellFormula: false, cellStyles: false, cellNF: false, cellHTML: false }); }
    catch (e) { console.error("[upload-cotacao v18.11] XLSX.read falhou:", (e as Error).message); return json({ erro: "Não foi possível abrir a planilha. Ela pode estar corrompida, protegida por senha, ou não ser um .xlsx válido. Reabra no Excel e salve novamente como .xlsx antes de enviar." }, 400); }
    if (!wb || !Array.isArray(wb.SheetNames) || wb.SheetNames.length === 0) return json({ erro: "A planilha não tem abas legíveis. Verifique se o arquivo não está vazio ou corrompido." }, 400);
    const det = detectarTipo(wb);
    if (det.tipo === null) return json({ erro: "Não foi possível identificar o tipo da planilha. Esperado: modelo Nexo (abas RESUMO/PLANILHA/CONDIÇÕES GERAIS) ou um quantitativo com cabeçalho ITEM/DESCRIÇÃO/QUANT/PREÇO.", sheets_encontradas: wb.SheetNames }, 400);
    if (det.tipo === "cot") return json({ erro: "Esta é uma planilha COT (Consolidação Nexo). O sistema não aceita upload de COT — apenas propostas de proponentes." }, 400);
    let estrutura: ParsedItem[] = []; let valores: ParsedVal[] = []; let respostas: ParsedResp[] = []; let quests: ParsedQuestionamento[] = []; let bdi: number | null = null; const layout = det.tipo;
    try {
      if (det.tipo === "por") { estrutura = parsePorEstrutura(wb); valores = parsePorPlanilhaVal(wb); respostas = parsePorRespostas(wb); quests = parsePorQuest(wb); } else { const q = parseQuant(det.ws!, det.det.headerRow, det.det.cols); estrutura = q.estrutura; valores = q.valores; bdi = q.bdi; }
    } catch (e) { console.error("[upload-cotacao v18.11] parse falhou:", (e as Error).message); return json({ erro: `Não foi possível ler o conteúdo da planilha (layout ${layout}). Confira se ela segue o modelo esperado. Detalhe técnico: ${(e as Error).message}` }, 400); }
    if (valores.length === 0) return json({ erro: `A planilha foi lida (layout ${layout}), mas nenhum item com valor foi encontrado. Confira se os preços/quantidades estão preenchidos no modelo correto.`, layout }, 400);
    if (previewFlag) {
      const { data: cot } = await supabaseAdmin.from("cotacoes").select("id").eq("projeto_id", projetoId).eq("numero_pacote", numeroPacote).eq("status", "ativa").maybeSingle();
      const existentes = new Set<string>(); const codigos = new Map<string, number>(); let temMacro = false;
      if (cot) { const { data: its } = await supabaseAdmin.from("itens").select("codigo_item, macro").eq("cotacao_id", cot.id).eq("origem_omisso", false); for (const it of its ?? []) { existentes.add(chave(it.macro ?? undefined, it.codigo_item)); codigos.set(it.codigo_item, (codigos.get(it.codigo_item) ?? 0) + 1); if (it.macro) temMacro = true; } }
      const primeira = existentes.size === 0;
      const estrutura_formato = primeira ? null : (temMacro ? "por" : "quant");
      let casaram = 0; for (const v of valores) if (existentes.has(chave(v.macro, v.codigo_item)) || codigos.get(v.codigo_item)) casaram++;
      const amostra = valores.slice(0, 8).map((v) => ({ codigo: v.codigo_item, qtd: v.quantidade_proponente ?? null, preco_unitario: v.preco_unitario ?? null, material: v.preco_unit_material ?? null, mao_obra: v.preco_unit_mao_obra ?? null }));
      return json({ preview: true, layout, estrutura_formato, formato_incompativel: !primeira && !!estrutura_formato && layout !== estrutura_formato, total_itens: valores.length, primeira_por: primeira, casaram: primeira ? valores.length : casaram, nao_casaram: primeira ? 0 : (valores.length - casaram), bdi, amostra });
    }
    const result = await handleUpload({ estrutura, valores, respostas, quests, bdi, layout, fileName: file.name, fileSize: file.size, fileBuffer: buffer, projetoId, numeroPacote, empresaIdExistente: empresaIdParam, empresaNomeNova: empresaNomeNovaParam, supabaseAdmin, userId: user.id });
    return json(result);
  } catch (err) { console.error("[upload-cotacao v18.11] ERROR:", (err as Error).message); console.error((err as Error).stack); return json({ erro: (err as Error).message }, 500); }
});
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } }); }
