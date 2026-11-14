import { calcHwan, calcLevelHwan, standardStats } from '../src/lib/hwan.js'
import { cappedPct, smartPct } from '../src/lib/format.js'
import { judgeDragon } from '../src/lib/dragon.js'
import { searchPlansSync } from '../src/lib/trans.js'
import pets from '../src/data/pets.json' with { type: 'json' }
const p = pets.find(x=>x.name==='부루마루' && x.source==='운영지원')
const r = calcHwan(p,[0,0,0,0])
console.log(r.total, r.hwanCount, cappedPct(r.hwanRate), cappedPct(r.weightedHwanRate), smartPct(r.appearRate), r.bestGrade)
console.log(standardStats(p,60))
let t=Date.now(); const L = calcLevelHwan(p,60,[standardStats(p,60).hp,standardStats(p,60).atk,standardStats(p,60).def,standardStats(p,60).agi]); console.log('lvl', L.hwanRate, L.bestGrade, L.grades.length, Date.now()-t,'ms')
t=Date.now(); const s=standardStats(p,140); const d=judgeDragon(p,140,[s.hp,s.atk,s.def,s.agi]); console.log('dragon', d.tier.name, d.closeness, d.top, d.stats.map(x=>x.max), Date.now()-t,'ms')
t=Date.now(); const res=searchPlansSync({main:3,target:179,mins:[0,0,0,0],stages:[0,1,2,3,4].map(i=>({level:null,alloc:[null,null,null,null],quest:[10,20,30,40,50][i]}))}); console.log('trans', res.exp?.total, res.exp?.exp, res.exp?.levels, res.exp?.resets, res.balanced?.resets, Date.now()-t,'ms')
