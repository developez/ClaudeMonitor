const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
process.env.TZ = 'Europe/Madrid';

// Run the real inline application, replacing only browser/HTTP boundaries.
function app(storage = new Map()) {
  const html = readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, innerHTML: '',
      parentElement: { clientWidth: 1200 }, addEventListener() {} });
    return elements.get(id);
  };
  const context = vm.createContext({
    console, TextDecoderStream, Response, setTimeout, clearTimeout,
    document: { getElementById: element, querySelectorAll: () => [], documentElement: {} },
    getComputedStyle: () => ({ getPropertyValue: () => '#888' }),
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k), key: i => [...storage.keys()][i], get length() { return storage.size; } },
    window: { matchMedia: () => ({ addEventListener() {} }), addEventListener() {} },
    location: { hash: '', pathname: '/' }, history: { replaceState() {} },
    Chart: class { constructor(canvas, config) { this.config = config; } destroy() {} },
    fetch: async () => { throw new Error('Unexpected HTTP request'); },
  });
  vm.runInContext(source.replace(/init\(\)\.catch\([\s\S]*$/, ''), context);
  // Existing tests exercise the entire history; date-specific tests set their bounds.
  element('dateFrom').value = '';
  element('dateTo').value = '';
  const run = code => vm.runInContext(code, context);
  const json = code => JSON.parse(JSON.stringify(run(code)));
  return { context, run, json, element, storage };
}

test('transcripts retain hourly usage after deduplication, with daily totals unchanged', async () => {
  const a = app();
  const line = (id, ts, n) => JSON.stringify({ type: 'assistant', timestamp: ts, requestId: id,
    message: { id, model: 'claude-sonnet-4-6', usage: { input_tokens: n, cache_creation_input_tokens: 10,
      cache_creation: { ephemeral_1h_input_tokens: 4 } } } });
  const body = [line('a', '2026-11-20T01:59:59Z', 9), line('a', '2026-11-20T01:59:59Z', 100),
    line('b', '2026-11-20T02:00:00Z', 200)].join('\n');
  a.context.fetch = async () => new Response(body);
  a.context.result = await a.run("parseTranscript('fixture')");
  assert.equal(a.run("result.days['2026-11-20']['claude-sonnet-4-6'].input_tokens"), 300);
  assert.equal(a.run("result.hours?.['2026-11-20T02']?.['claude-sonnet-4-6'].input_tokens"), 100);
  assert.equal(a.run("result.hours?.['2026-11-20T03']?.['claude-sonnet-4-6'].cw1h"), 4);
  assert.equal(a.run('result.requests'), 2);
});

test('hour blocks use local midnight boundaries and conserve tokens at all granularities', () => {
  const a = app();
  a.run("globalThis.fixture = Object.fromEntries([['00',1],['02',2],['03',4],['07',8],['08',16],['11',32],['12',64],['23',128]].map(([h,n]) => ['2026-11-20T'+h, {m:{input_tokens:n}}]))");
  assert.equal(a.run('typeof groupHours'), 'function');
  assert.deepEqual(a.json('Object.keys(groupHours(fixture, 3))'), ['2026-11-20T00','2026-11-20T03','2026-11-20T06','2026-11-20T09','2026-11-20T12','2026-11-20T21']);
  assert.deepEqual(a.json('Object.values(groupHours(fixture, 8)).map(m => m.m.input_tokens)'), [15,112,128]);
  assert.deepEqual(a.json('Object.values(groupHours(fixture, 12)).map(m => m.m.input_tokens)'), [63,192]);
  for (const span of [1,3,8,12]) assert.equal(a.run(`Object.values(groupHours(fixture, ${span})).reduce((n,m) => n+m.m.input_tokens,0)`), 255);
});

test('range fills gaps across midnight and daylight saving without shifting block boundaries', () => {
  const a = app();
  assert.equal(a.run('typeof timeRange'), 'function');
  assert.deepEqual(a.json("timeRange(['2026-11-20T21','2026-11-21T03'],3)"), ['2026-11-20T21','2026-11-21T00','2026-11-21T03']);
  assert.deepEqual(a.json("timeRange(['2026-03-29T00','2026-03-29T12'],3)"), ['2026-03-29T00','2026-03-29T03','2026-03-29T06','2026-03-29T09','2026-03-29T12']);
  assert.deepEqual(a.json("timeRange(['2026-10-24','2026-10-26'],24)"), ['2026-10-24','2026-10-25','2026-10-26']);
});

test('old transcript cache is rebuilt once, then new hourly cache is reused', async () => {
  const a = app();
  a.storage.set('cm3:fixture', JSON.stringify({ mtime: 'same', size: '100', data: { old: true } }));
  let reads = 0;
  a.context.fetch = async (url, opts) => {
    if (opts?.method === 'HEAD') return new Response('', { headers: { 'Last-Modified': 'same', 'Content-Length': '100' } });
    reads++;
    return new Response('');
  };
  const first = await a.run("summary('fixture')");
  const second = await a.run("summary('fixture')");
  assert.equal(first.old, undefined);
  assert.equal(reads, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(second.hours)), {});
});

test('chart uses selected blocks, zero gaps, project/cache filters and unchanged costs', () => {
  const a = app();
  a.element('granularity').value = '3';
  a.element('project').value = 'p';
  a.run(`tab='days'; sessions=[{project:'p',done:true,
    days:{'2026-11-20':{'claude-sonnet-4-6':{input_tokens:300,cache_read_input_tokens:100}}},
    hours:{'2026-11-20T00':{'claude-sonnet-4-6':{input_tokens:100,cache_read_input_tokens:100}},'2026-11-20T06':{'claude-sonnet-4-6':{input_tokens:200}}}},
    {project:'other',done:true,hours:{'2026-11-20T00':{m:{input_tokens:999}}}}]; renderDays()`);
  assert.deepEqual(a.json('dayChart.config.data.datasets[0].data'), [100,0,200]);
  assert.match(a.element('daysMeta').innerHTML, /Tramos con actividad/);
  assert.match(a.run('dayChart.config.options.plugins.tooltip.callbacks.title([{dataIndex:0}])'), /00:00.*03:00/);
  a.element('hideCacheRead').checked = true;
  a.element('metric').value = 'cost';
  a.run('renderDays()');
  const total = a.run('dayChart.config.data.datasets.reduce((n,d)=>n+d.data.reduce((a,b)=>a+b,0),0)');
  assert.ok(Math.abs(total - 0.0009 / 1.0992) < 1e-12);
  a.element('granularity').value = '24';
  a.run('renderDays()');
  assert.ok(Math.abs(a.run('dayChart.config.data.datasets.reduce((n,d)=>n+d.data[0],0)')-total) < 1e-12);
  a.element('groupBy').value = 'model';
  for (const span of [1,3,8,12]) {
    a.element('granularity').value = String(span);
    a.run('renderDays()');
    assert.equal(a.run('dayChart.config.data.datasets.length'),1);
    assert.equal(a.run('dayChart.config.data.datasets[0].label'),'claude-sonnet-4-6');
    assert.ok(Math.abs(a.run('dayChart.config.data.datasets[0].data.reduce((a,b)=>a+b,0)')-total) < 1e-12);
  }
});

test('main sessions and agents contribute hourly usage to cached session summaries', async () => {
  const a = app();
  a.run("listDir = async () => [{name:'agent-a.jsonl',dir:false}]; sessions=[{project:'p',path:'main',dirPath:'session/',hasDir:true,mtime:'same'}]");
  a.context.fetch = async (url, opts) => {
    if (opts?.method === 'HEAD') return new Response('', { headers: { 'Last-Modified': 'same', 'Content-Length': '100' } });
    if (url.endsWith('.meta.json')) return new Response('{}');
    return new Response(JSON.stringify({ type:'assistant',timestamp:'2026-11-20T07:00:00Z',requestId:url,
      message:{id:url,model:'claude-sonnet-4-6',usage:{input_tokens:url==='main'?100:50}} }));
  };
  await a.run('loadDetail(sessions[0])');
  assert.equal(a.run("sessions[0].hours?.['2026-11-20T08']?.['claude-sonnet-4-6'].input_tokens"),150);
  assert.equal(a.run("cacheGet('session:main').data.hours['2026-11-20T08']['claude-sonnet-4-6'].input_tokens"),150);
  assert.equal(a.run('sessions[0].total'),150);
});

test('empty hourly blocks keep a zero tooltip and callbacks tolerate no items', () => {
  const a = app();
  a.element('granularity').value = '1';
  a.run(`tab='days'; sessions=[{done:true,hours:{
    '2026-11-20T00':{m:{input_tokens:100}}, '2026-11-20T02':{m:{input_tokens:200}}
  }}]; renderDays()`);
  assert.equal(a.run('dayChart.config.options.plugins.tooltip.filter({raw:0,dataIndex:1})'),true);
  assert.match(a.run('dayChart.config.options.plugins.tooltip.callbacks.title([{dataIndex:1}])'),/01:00.*02:00/);
  assert.equal(a.run('dayChart.config.options.plugins.tooltip.callbacks.title([])'),'');
  assert.deepEqual(a.json('dayChart.config.options.plugins.tooltip.callbacks.footer([])'),[]);
});

test('changing browser time zone regenerates cached local-hour summaries', async () => {
  const madrid = app();
  madrid.run("cacheSet('fixture',{mtime:'same',size:'100',data:{oldZone:true}})");
  process.env.TZ = 'UTC';
  try {
    const utc = app(madrid.storage);
    let reads = 0;
    utc.context.fetch = async (url, opts) => {
      if (opts?.method==='HEAD') return new Response('',{headers:{'Last-Modified':'same','Content-Length':'100'}});
      reads++;
      return new Response(JSON.stringify({type:'assistant',timestamp:'2026-11-20T07:00:00Z',requestId:'a',
        message:{id:'a',model:'m',usage:{input_tokens:100}}}));
    };
    const result = await utc.run("summary('fixture')");
    assert.equal(result.oldZone,undefined);
    assert.equal(reads,1);
    assert.equal(result.hours['2026-11-20T07'].m.input_tokens,100);
  } finally {
    process.env.TZ = 'Europe/Madrid';
  }
});

test('cache cleanup removes only obsolete monitor data and discovery ignores old session summaries', async () => {
  const a = app();
  a.storage.set('cm3:session:claude-projects/p/s.jsonl',JSON.stringify({mtime:'same',data:{done:true,total:999}}));
  a.storage.set('unrelated-preference','keep');
  a.run("listDir = async url => url==='claude-projects/' ? [{name:'p',dir:true}] : [{name:'s.jsonl',dir:false}]");
  a.context.fetch = async () => new Response('',{headers:{'Last-Modified':'same','Content-Length':'0'}});
  const sessions = await a.run('discover()');
  assert.equal(sessions[0].done,undefined);
  a.run("cacheSet('session:claude-projects/p/s.jsonl',{mtime:'same',data:{total:150,hours:{'2026-11-20T08':{m:{input_tokens:150}}}}})");
  const cached = await a.run('discover()');
  assert.equal(cached[0].done,true);
  assert.equal(cached[0].hours['2026-11-20T08'].m.input_tokens,150);
  a.run("cacheSet('current',{hours:{}}); clearLegacyCache()");
  assert.equal(a.storage.has('cm3:session:claude-projects/p/s.jsonl'),false);
  assert.equal(a.storage.get('unrelated-preference'),'keep');
  assert.deepEqual(a.json("cacheGet('current')"),{hours:{}});
});

test('date defaults cover today and two previous local calendar days', () => {
  const a = app();
  assert.equal(a.run('typeof setDefaultDateRange'),'function');
  for (const [now, from, to] of [
    ['2026-11-21T12:00:00','2026-11-19','2026-11-21'],
    ['2026-03-01T00:30:00','2026-02-27','2026-03-01'],
    ['2026-03-30T00:30:00','2026-03-28','2026-03-30'],
  ]) {
    a.run(`setDefaultDateRange(new Date('${now}'))`);
    assert.equal(a.element('dateFrom').value,from);
    assert.equal(a.element('dateTo').value,to);
  }
});

test('date filter includes both boundary days for every granularity and scopes totals and sessions', () => {
  const a = app();
  a.element('dateFrom').value='2026-11-20';
  a.element('dateTo').value='2026-11-21';
  a.run(`tab='days'; sessions=[{done:true,
    days:{'2026-11-19':{'claude-sonnet-4-6':{input_tokens:999}},'2026-11-20':{'claude-sonnet-4-6':{input_tokens:100}},'2026-11-21':{'claude-sonnet-4-6':{input_tokens:200}},'2026-11-22':{'claude-sonnet-4-6':{input_tokens:999}}},
    hours:{'2026-11-19T23':{'claude-sonnet-4-6':{input_tokens:999}},'2026-11-20T00':{'claude-sonnet-4-6':{input_tokens:100}},'2026-11-21T23':{'claude-sonnet-4-6':{input_tokens:200}},'2026-11-22T00':{'claude-sonnet-4-6':{input_tokens:999}}}},
    {done:true,days:{'2026-11-18':{m:{input_tokens:999}}},hours:{'2026-11-18T00':{m:{input_tokens:999}}}}]`);
  for (const span of [24,1,3,8,12]) {
    a.element('granularity').value=String(span);
    a.element('metric').value='tokens';
    a.run('renderDays()');
    assert.equal(a.run('dayChart.config.data.datasets[0].data.reduce((a,b)=>a+b,0)'),300);
    assert.equal(a.run('dayChart.config.data.labels.length'),48/span);
    assert.match(a.element('daysMeta').innerHTML,/Sesiones: <b>1<\/b>/);
    a.element('metric').value='cost';
    a.run('renderDays()');
    assert.ok(Math.abs(a.run('dayChart.config.data.datasets[0].data.reduce((a,b)=>a+b,0)')-0.0009/1.0992)<1e-12);
  }
  a.element('dateFrom').value='2026-11-19';
  a.element('dateTo').value='2026-11-21';
  a.element('granularity').value='24';
  a.run('renderDays()');
  assert.equal(a.run('dayChart.config.data.labels.length'),3);
});

test('empty or reversed date ranges clear the previous chart, and bounds may be open', () => {
  const a=app();
  a.run("tab='days'; sessions=[{done:true,days:{'2026-11-20':{m:{input_tokens:100}}}}]; renderDays()");
  a.element('dateFrom').value='2026-11-21';
  a.element('dateTo').value='2026-11-22';
  a.run('renderDays()');
  assert.equal(a.run('dayChart'),null);
  assert.match(a.element('daysMeta').innerHTML,/Sin datos/);
  a.element('dateTo').value='2026-11-19';
  a.run('renderDays()');
  assert.match(a.element('daysMeta').innerHTML,/Desde.*Hasta/);
  a.element('dateFrom').value='';
  a.element('dateTo').value='2026-11-20';
  a.run('renderDays()');
  assert.equal(a.run('dayChart.config.data.datasets[0].data[0]'),100);
});

test('selected calendar dates keep quiet leading and trailing days as zero', () => {
  const a=app();
  a.element('dateFrom').value='2026-11-19';
  a.element('dateTo').value='2026-11-21';
  a.run(`tab='days'; sessions=[{done:true,days:{'2026-11-20':{m:{input_tokens:100}}},
    hours:{'2026-11-20T08':{m:{input_tokens:100}}}}]; renderDays()`);
  assert.deepEqual(a.json('dayChart.config.data.datasets[0].data'),[0,100,0]);
  assert.match(a.element('daysMeta').innerHTML,/Días con actividad: <b>1<\/b>/);
  a.element('granularity').value='1';
  a.run('renderDays()');
  assert.equal(a.run('dayChart.config.data.labels.length'),72);
  assert.equal(a.run('dayChart.config.data.datasets[0].data[32]'),100);
  assert.equal(a.run('dayChart.config.data.datasets[0].data.reduce((a,b)=>a+b,0)'),100);
});

test('very large hourly date ranges ask for a narrower interval before building a chart', () => {
  const a=app();
  a.element('dateFrom').value='2020-01-01';
  a.element('dateTo').value='2026-11-21';
  a.element('granularity').value='1';
  a.run("tab='days'; sessions=[{done:true,hours:{'2026-11-20T08':{m:{input_tokens:100}}}}]; renderDays()");
  assert.equal(a.run('dayChart === null'),true);
  assert.match(a.element('daysMeta').innerHTML,/Reduce.*fechas.*granularidad/);
  a.element('granularity').value='24';
  a.run("sessions[0].days={'2026-11-20':{m:{input_tokens:100}}}; renderDays()");
  assert.equal(a.run('dayChart !== null'),true);
});

test('day/night boundaries split mixed hour blocks at 08:00 and 20:00', () => {
  const a=app();
  assert.equal(a.run('typeof dayNightSegments'),'function');
  assert.deepEqual(a.json("dayNightSegments(['2026-11-20T06'],3)"),[
    {start:0,end:2/3,day:false},{start:2/3,end:1,day:true},
  ]);
  assert.deepEqual(a.json("dayNightSegments(['2026-11-20T16'],8)"),[
    {start:0,end:0.5,day:true},{start:0.5,end:1,day:false},
  ]);
  assert.deepEqual(a.json("dayNightSegments(['2026-11-20T00','2026-11-20T12'],12)"),[
    {start:0,end:2/3,day:false},{start:2/3,end:1+2/3,day:true},{start:1+2/3,end:2,day:false},
  ]);
  assert.deepEqual(a.json("dayNightSegments(['2026-11-20T21','2026-11-21T00','2026-11-21T03'],3)"),[
    {start:0,end:3,day:false},
  ]);
});

test('day/night switch paints chart background behind unchanged usage and turns off in daily mode', () => {
  const a=app();
  a.element('granularity').value='8';
  a.run(`tab='days'; sessions=[{done:true,
    hours:{'2026-11-20T00':{m:{input_tokens:100}},'2026-11-20T16':{m:{input_tokens:200}}},
    days:{'2026-11-20':{m:{input_tokens:300}}}}]; renderDays()`);
  const before=a.json('dayChart.config.data');
  a.element('showDayNight').checked=true;
  a.run('renderDays()');
  assert.deepEqual(a.json('dayChart.config.data'),before);
  assert.equal(a.element('dayNightLegend').hidden,false);
  assert.equal(a.run("dayChart.config.plugins.some(p=>p.id==='dayNightBands')"),true);
  a.run(`globalThis.rects=[]; globalThis.symbols=[];
    globalThis.fakeCanvas={chartArea:{left:10,right:310,top:20,bottom:220},ctx:{
      save(){},restore(){},beginPath(){},rect(){},clip(){},
      fillRect(x,y,w,h){rects.push([x,y,w,h,this.fillStyle])},
      fillText(s){symbols.push(s)}
    }};
    dayChart.config.plugins.find(p=>p.id==='dayNightBands').beforeDraw(fakeCanvas)`);
  assert.deepEqual(a.json('rects.map(r=>r.slice(0,4))'),[
    [10,20,100,200],[110,20,150,200],[260,20,50,200],
  ]);
  assert.ok(a.json('symbols').some(s=>s.includes('☀')));
  assert.ok(a.json('symbols').some(s=>s.includes('☾') && s.includes('✦')));
  a.element('showDayNight').checked=false;
  a.run('renderDays()');
  assert.equal(a.element('dayNightLegend').hidden,true);
  a.run("rects=[]; dayChart.config.plugins.find(p=>p.id==='dayNightBands')?.beforeDraw(fakeCanvas)");
  assert.deepEqual(a.json('rects'),[]);
  a.element('showDayNight').checked=true;
  a.element('granularity').value='24';
  a.run('renderDays()');
  assert.equal(a.element('showDayNight').disabled,true);
  assert.equal(a.element('dayNightLegend').hidden,true);
  a.run("rects=[]; dayChart.config.plugins.find(p=>p.id==='dayNightBands')?.beforeDraw(fakeCanvas)");
  assert.deepEqual(a.json('rects'),[]);
});


test('hourly views retain the remote label layout for ranges longer than 31 blocks',()=>{
  const a=app();
  a.element('dateFrom').value='2026-11-19';
  a.element('dateTo').value='2026-11-21';
  a.element('granularity').value='1';
  a.run("tab='days'; sessions=[{done:true,hours:{'2026-11-20T08':{m:{input_tokens:100}}}}]; renderDays()");
  a.run("globalThis.captions=[]; globalThis.labelChart={data:dayChart.config.data,scales:{x:{width:1200}},ctx:{save(){},restore(){},translate(){},rotate(){},measureText(s){return {width:s.length*6}},fillText(s){captions.push(s)}},getDatasetMeta(){return {hidden:false,data:Array.from({length:72},(_,i)=>({x:i*16,y:100}))}}};dayChart.config.plugins.find(p=>p.id==='dayTotals').afterDatasetsDraw(labelChart)");
  assert.equal(a.run('captions.length'),2);
  assert.equal(a.run('captions[0]'),'100');
});
