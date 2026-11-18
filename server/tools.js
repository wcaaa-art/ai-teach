// @ts-check
import { searchCurriculum } from './curriculum.js'
import { searchPassages } from './rag/index.js'
import { hybridSearch } from './rag/hybrid.js'
import { isRerankEnabled, rerankPassages } from './rag/rerank.js'
import { listWeakPoints, saveWeakPoint } from './weak-points.js'

export const toolSchemas = [
  { type:'function', function:{ name:'calc_review_interval', description:'根据艾宾浩斯遗忘曲线计算复习时间', parameters:{ type:'object', properties:{ last_study_time:{type:'number'}, mastery_level:{type:'integer',enum:[0,1,2,3]} }, required:['last_study_time','mastery_level'], additionalProperties:false } } },
  { type:'function', function:{ name:'rag_knowledge_query', description:'混合检索课标知识点与中考真题解析，返回知识点名称和可引用的原文片段', parameters:{ type:'object', properties:{subject:{type:'string'},grade:{type:'string'},keyword:{type:'string'}}, required:['subject','grade','keyword'], additionalProperties:false } } },
  { type:'function', function:{ name:'get_recent_focus_record', description:'读取IndexedDB历史专注记录，包含：总时长、任务完成率、分心次数、视觉监督下的连续离岗记录', parameters:{type:'object',properties:{days:{type:'number'}},required:['days'],additionalProperties:false} } },
  { type:'function', function:{ name:'visual_monitor_get_status', description:'读取前端推送的视觉监督状态（前端持续推送状态给后端Agent上下文，不推送图像）', parameters:{type:'object',properties:{is_present:{type:'boolean'},continuous_away_seconds:{type:'number'}},required:['is_present','continuous_away_seconds'],additionalProperties:false} } },
  { type:'function', function:{ name:'save_weak_point', description:'把本轮确认的薄弱知识点写入本地薄弱点清单，供后续复习与计划调整引用', parameters:{type:'object',properties:{subject:{type:'string'},grade:{type:'string'},point:{type:'string'},reason:{type:'string'}},required:['subject','point'],additionalProperties:false} } },
  { type:'function', function:{ name:'list_weak_points', description:'读取已记录的薄弱知识点清单', parameters:{type:'object',properties:{limit:{type:'integer'}},required:['limit'],additionalProperties:false} } }
]

// 在执行模型生成的工具调用前，按同一份固定 schema 做二次类型校验。
export function validateToolArguments(name, args) {
  const definition = toolSchemas.find(tool => tool.function.name === name)?.function.parameters
  if (!definition || !args || typeof args !== 'object' || Array.isArray(args)) return false
  const expected = Object.keys(definition.properties)
  if (Object.keys(args).some(key => !expected.includes(key))) return false
  if (definition.required.some(key => !(key in args))) return false
  return expected.every(key => {
    const value = args[key]
    if (value === undefined) return true
    const schema = definition.properties[key]
    const validType = schema.type === 'string' ? typeof value === 'string'
      : schema.type === 'boolean' ? typeof value === 'boolean'
        : schema.type === 'integer' ? Number.isInteger(value)
          : schema.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
            : false
    return validType && (!schema.enum || schema.enum.includes(value))
  })
}

/**
 * @param {string} name
 * @param {Record<string, any>} [args]
 * @param {Record<string, any>} [context]
 * @returns {any}
 */
export function executeTool(name, args = {}, context = {}) {
  if(name==='calc_review_interval') {
    const lastStudyTime=Number(args.last_study_time);const mastery=Number(args.mastery_level)
    if(!Number.isFinite(lastStudyTime)||!Number.isInteger(mastery)||mastery<0||mastery>3)return {error:'invalid_arguments'}
    const intervals=[1,2,4,7];const days=intervals[mastery]
    return {lastStudyTime,masteryLevel:mastery,nextReviewTime:lastStudyTime+days*86400000,intervalDays:days,rule:'艾宾浩斯间隔复习'}
  }
  if(name==='rag_knowledge_query') {
    if(![args.subject,args.grade,args.keyword].every(value=>typeof value==='string'&&value.trim()))return {error:'invalid_arguments'}
    const result=searchCurriculum(args)
    // 课标知识点负责“学什么”，真题片段负责“练什么、怎么讲”，两路结果合并给模型引用。
    // 混合检索默认关闭：评测显示当前语料上稠密通道与 BM25 同源、无实质增益，
    // 默认走 BM25 可保证答疑引用质量不受影响；设 RAG_HYBRID=1 可开启双路 RRF 融合。
    // 先多取两题做候选池，再重排取前 4 条：重排只改顺序，不改变"能不能召回到"。
    const recalled=process.env.RAG_HYBRID==='1'
      ? hybridSearch({query:args.keyword,subject:args.subject,grade:args.grade,topK:6})
      : searchPassages({query:args.keyword,subject:args.subject,grade:args.grade,topK:6})
    const passages=isRerankEnabled()
      ? rerankPassages(recalled,{query:args.keyword,subject:args.subject,grade:args.grade}).slice(0,4)
      : recalled.slice(0,4)
    // 公式抽取丢失的片段留给自己参考，但不作为「检索依据」展示，也不许模型整段引用。
    // 若整批都不可读，至少保留分最高的一条（宁可给一条带出处的残句，也不要让「依据」整块消失）。
    const usablePassages=passages.filter(item=>item.quality===undefined||item.quality>=0.42)
    const citePassages=usablePassages.length?usablePassages:passages.slice(0,1)
    return {
      ...result,
      matches:result.matches.map(item=>item.name),
      items:result.matches,
      passages,
      // 引用除出处文案外带上片段原文与低质标记，前端点开就能核对 AI 到底看了哪段。
      citations:citePassages.map(item=>({
        text:`${item.citation}：${item.subject}${item.year}年${item.exam}真题`,
        snippet:item.text,
        lowQuality:item.lowQuality
      })),
      passagesNote:usablePassages.length<passages.length?'部分真题片段在 PDF 抽取时丢失公式符号，只能参考解析思路，不得整段引用或照抄题面。':'',
      source:'curriculum+exam-rag'
    }
  }
  if(name==='get_recent_focus_record') return context.recentFocus || {days:args.days||7,totalFocusMinutes:0,taskCompletionRate:0,distractionCount:0,visualAwayRecords:0}
  if(name==='visual_monitor_get_status') {const status=context.visualStatus||args;return {is_present:Boolean(status.is_present??status.isPresent),continuous_away_seconds:Math.max(0,Number(status.continuous_away_seconds??status.continuousAwaySeconds)||0)}}
  if(name==='save_weak_point') {
    if(typeof args.subject!=='string'||!args.subject.trim()||typeof args.point!=='string'||!args.point.trim())return {error:'invalid_arguments'}
    return saveWeakPoint({subject:args.subject,grade:args.grade||'',point:args.point,reason:args.reason||''})
  }
  if(name==='list_weak_points') return listWeakPoints(Number(args.limit)||20)
  return {message:'unknown tool'}
}
