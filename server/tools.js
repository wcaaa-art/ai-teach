// @ts-check
import { searchCurriculum } from './curriculum.js'
import { searchPassages, formatCitation } from './rag/index.js'

export const toolSchemas = [
  { type:'function', function:{ name:'calc_review_interval', description:'根据艾宾浩斯遗忘曲线计算复习时间', parameters:{ type:'object', properties:{ last_study_time:{type:'number'}, mastery_level:{type:'integer',enum:[0,1,2,3]} }, required:['last_study_time','mastery_level'], additionalProperties:false } } },
  { type:'function', function:{ name:'rag_knowledge_query', description:'混合检索课标知识点与中考/高考真题解析，返回知识点名称和可引用的原文片段', parameters:{ type:'object', properties:{subject:{type:'string'},grade:{type:'string'},keyword:{type:'string'}}, required:['subject','grade','keyword'], additionalProperties:false } } },
  { type:'function', function:{ name:'get_recent_focus_record', description:'读取IndexedDB历史专注记录，包含：总时长、任务完成率、分心次数、视觉监督下的连续离岗记录', parameters:{type:'object',properties:{days:{type:'number'}},required:['days'],additionalProperties:false} } },
  { type:'function', function:{ name:'visual_monitor_get_status', description:'读取前端推送的视觉监督状态（前端持续推送状态给后端Agent上下文，不推送图像）', parameters:{type:'object',properties:{is_present:{type:'boolean'},continuous_away_seconds:{type:'number'}},required:['is_present','continuous_away_seconds'],additionalProperties:false} } }
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

const knowledge = {
  数学: ['二次函数的图像与性质','一次函数与方程组','全等三角形判定','概率初步'],
  物理: ['力与运动','电路与欧姆定律','能量守恒'],
  化学: ['化学方程式配平','物质构成的奥秘','酸碱盐'],
  英语: ['阅读理解策略','时态与语态','写作结构'],
  语文: ['记叙文阅读','古诗文积累','议论文论证']
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
    const passages=searchPassages({query:args.keyword,subject:args.subject,grade:args.grade,topK:4})
    return {
      ...result,
      matches:result.matches.map(item=>item.name),
      items:result.matches,
      passages,
      citations:passages.map(item=>`${item.citation}：${item.subject}${item.year}年${item.exam}真题`),
      source:'curriculum+exam-rag'
    }
  }
  if(name==='get_recent_focus_record') return context.recentFocus || {days:args.days||7,totalFocusMinutes:0,taskCompletionRate:0,distractionCount:0,visualAwayRecords:0}
  if(name==='visual_monitor_get_status') {const status=context.visualStatus||args;return {is_present:Boolean(status.is_present??status.isPresent),continuous_away_seconds:Math.max(0,Number(status.continuous_away_seconds??status.continuousAwaySeconds)||0)}}
  return {message:'unknown tool'}
}
