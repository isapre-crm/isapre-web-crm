import {useState} from 'react';
import {ArrowRight, CheckCircle2, ChevronDown, ClipboardList, SearchCheck, ShieldCheck} from 'lucide-react';
import type {SiteContent} from './siteContent';
import './crm-v40-commercial.css';
export type QuoteAnswers = {current_isapre:string;budget_range:string;priority:string};
export function CommercialHero({content,onQuote}:{content:SiteContent;onQuote:()=>void}){
 return <section className="v4-commercial shell" id="planes"><div className="v4-commercial-copy"><span className="eyebrow">{content.commercial.eyebrow}</span><h2>{content.commercial.title}</h2><p>{content.commercial.description}</p><button className="btn primary" onClick={onQuote}>{content.commercial.cta} <ArrowRight size={18}/></button></div><div className="v4-commercial-art" aria-hidden="true"><ShieldCheck size={74}/><span>Orientación en salud</span><small>Información para decidir mejor</small></div></section>;
}
export function HowItWorks({content}:{content:SiteContent}){
 const steps=[{icon:<ClipboardList/>,title:content.steps.step1Title,body:content.steps.step1Body},{icon:<SearchCheck/>,title:content.steps.step2Title,body:content.steps.step2Body},{icon:<CheckCircle2/>,title:content.steps.step3Title,body:content.steps.step3Body}];
 return <section className="shell section v4-steps" id="como-funciona"><div className="sectionHeading"><span className="eyebrow">{content.steps.eyebrow}</span><h2>{content.steps.title}</h2></div><div className="v4-step-grid">{steps.map((step,i)=><article className="v4-step" key={i}><span className="v4-step-icon">{step.icon}</span><small>PASO {i+1}</small><h3>{step.title}</h3><p>{step.body}</p></article>)}</div></section>;
}
export function FAQ({content}:{content:SiteContent}){
 const pairs=[[content.faq.q1,content.faq.a1],[content.faq.q2,content.faq.a2],[content.faq.q3,content.faq.a3],[content.faq.q4,content.faq.a4]];
 return <section className="shell section v4-faq" id="preguntas"><div className="sectionHeading"><h2>{content.faq.title}</h2></div><div className="v4-faq-list">{pairs.map(([q,a],i)=><details key={i}><summary>{q}<ChevronDown size={18}/></summary><p>{a}</p></details>)}</div></section>;
}
export function QuoteWizard({content,onFinish}:{content:SiteContent;onFinish:(answers:QuoteAnswers)=>void}){
 const [step,setStep]=useState(0);const [answers,setAnswers]=useState<QuoteAnswers>({current_isapre:'Prefiero no indicar',budget_range:'Por definir',priority:'Equilibrio entre cobertura y precio'});
 const fields:[keyof QuoteAnswers,string,string[]][]=[['current_isapre','¿Cuál es tu situación actual?',['Prefiero no indicar','Fonasa','Banmédica','Colmena','Consalud','Cruz Blanca','Nueva Masvida','Vida Tres','Esencial','Otra Isapre']],['budget_range','¿Qué presupuesto mensual aproximado consideras?',['Por definir','Hasta $100.000','$100.001 a $200.000','$200.001 a $300.000','Más de $300.000']],['priority','¿Qué valoras más en un plan?',['Equilibrio entre cobertura y precio','Red de clínicas y prestadores','Cobertura hospitalaria','Menor costo mensual']]];
 const [field,title,options]=fields[step];
 return <section className="shell section v4-quote" id="cotizador"><div className="sectionHeading"><span className="eyebrow">{content.quote.eyebrow}</span><h2>{content.quote.title}</h2><p>{content.quote.description}</p></div><div className="v4-wizard"><div className="v4-progress" aria-label={`Paso ${step+1} de 3`}>{[0,1,2].map(i=><span key={i} className={i<=step?'active':''}/>)}</div><small>Paso {step+1} de 3</small><h3>{title}</h3><div className="v4-choice-grid">{options.map(option=><button type="button" key={option} className={answers[field]===option?'selected':''} aria-pressed={answers[field]===option} onClick={()=>setAnswers(prev=>({...prev,[field]:option}))}>{option}</button>)}</div><div className="v4-wizard-actions">{step>0&&<button type="button" className="btn outline" onClick={()=>setStep(s=>s-1)}>Anterior</button>}<button type="button" className="btn primary" onClick={()=>{if(step<2)setStep(s=>s+1);else onFinish(answers)}}>{step===2?'Continuar al formulario':'Siguiente'} <ArrowRight size={17}/></button></div><p className="small">No es una cotización vinculante ni una oferta de contratación. No solicitamos información médica.</p></div></section>;
}
