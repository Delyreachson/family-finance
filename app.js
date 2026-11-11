// Family Finance - Supabase connection settings
const SUPABASE_URL = 'https://ludrupofaaeqmqzvhvox.supabase.co';
// IMPORTANT: paste the same sb_publishable_ key from your currently working app.js here.
// Never use a service_role or secret key in a browser app.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wk15NsgFvDCkZbUuHVeyWg_YEHveiFp';
const $ = (id) => document.getElementById(id);

let db = null, chart = null, allTransactions = [], allCategories = [], categoryChannel = null, editingTransactionId = null;
// Theme preference is stored locally on this device; it does not affect family data.
const THEME_STORAGE_KEY = 'family-finance-theme';
function applyTheme(theme){
 const selected = theme === 'dark' ? 'dark' : 'light';
 document.documentElement.dataset.theme = selected;
 const button = $('themeToggle');
 if(button){
  const dark = selected === 'dark';
  button.setAttribute('aria-pressed',String(dark));
  button.setAttribute('aria-label',dark?'ប្ដូរទៅ Light Mode':'ប្ដូរទៅ Dark Mode');
  button.title = dark ? 'ប្ដូរទៅ Light Mode' : 'ប្ដូរទៅ Dark Mode';
  button.innerHTML = '<span class="theme-icon" aria-hidden="true">'+(dark?'☀️':'🌙')+'</span><span class="theme-label">'+(dark?'Light Mode':'Dark Mode')+'</span>';
 }
 if(chart){
  const dark = selected === 'dark';
  const tickColor = dark ? '#c2cede' : '#718096';
  const gridColor = dark ? 'rgba(190,205,225,.14)' : 'rgba(120,140,165,.16)';
  if(chart.options.scales?.x){chart.options.scales.x.ticks={...chart.options.scales.x.ticks,color:tickColor};chart.options.scales.x.grid={...chart.options.scales.x.grid,color:gridColor};}
  if(chart.options.scales?.y){chart.options.scales.y.ticks={...chart.options.scales.y.ticks,color:tickColor};chart.options.scales.y.grid={...chart.options.scales.y.grid,color:gridColor};}
  if(chart.options.plugins?.legend)chart.options.plugins.legend.labels={...chart.options.plugins.legend.labels,color:tickColor};
  chart.update('none');
 }
}
let savedTheme = 'light';
try{savedTheme=localStorage.getItem(THEME_STORAGE_KEY)||'light'}catch(error){}
applyTheme(savedTheme);
$('themeToggle').addEventListener('click',()=>{
 const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
 applyTheme(next);
 try{localStorage.setItem(THEME_STORAGE_KEY,next)}catch(error){}
});

const KEY_PLACEHOLDER = 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE';
const configured = SUPABASE_PUBLISHABLE_KEY !== KEY_PLACEHOLDER && SUPABASE_PUBLISHABLE_KEY.length > 20;

if (configured && window.supabase?.createClient) db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const money = (v) => new Intl.NumberFormat('km-KH',{maximumFractionDigits:0}).format(Number(v)||0)+' ៛';
const setMessage=(id,msg,error=false)=>{const el=$(id);el.textContent=msg;el.classList.toggle('error',error)};
const today = new Date(); $('date').value = localDate(today);
$('monthFilter').value = today.toISOString().slice(0,7);
if(!configured) $('setupNotice').classList.remove('hidden');
function localDate(d){const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return setMessage('loginMessage','សូមបញ្ចូល Publishable Key ក្នុង app.js ជាមុនសិន។',true);setMessage('loginMessage','កំពុងពិនិត្យគណនី...');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)return setMessage('loginMessage',error.message,true);await showApp()});
$('logoutBtn').addEventListener('click',async()=>{if(db)await db.auth.signOut();showLogin()});
$('refreshBtn').addEventListener('click',async()=>{await loadCategories();await loadTransactions()});$('monthFilter').addEventListener('change',renderDashboard);$('exportExcelBtn').addEventListener('click',exportMonthlyExcel);$('exportPdfBtn').addEventListener('click',exportMonthlyPdf);$('type').addEventListener('change',renderCategoryOptions);$('manageCategoriesBtn').addEventListener('click',()=>{$('categoryManager').scrollIntoView?.({behavior:'smooth'});$('categoryManager')?.classList.toggle('category-highlight')});$('addCategoryBtn').addEventListener('click',addCategory);$('categoryRows').addEventListener('click',handleCategoryAction);
$('transactionForm').addEventListener('submit',async e=>{e.preventDefault();if(!db)return;setMessage('formMessage','កំពុងរក្សាទុក...');const payload={transaction_type:$('type').value,amount:Number($('amount').value),currency:'KHR',category:$('category').value.trim(),description:$('description').value.trim()||null,transaction_date:$('date').value};const wasEditing=Boolean(editingTransactionId);const query=editingTransactionId?db.from('transactions').update(payload).eq('id',editingTransactionId):db.from('transactions').insert(payload);const {error}=await query;if(error)return setMessage('formMessage',error.message,true);resetTransactionForm();setMessage('formMessage',wasEditing?'បានកែប្រែប្រតិបត្តិការដោយជោគជ័យ។':'បានរក្សាទុកទិន្នន័យដោយជោគជ័យ។');await loadTransactions()});
$('cancelEditBtn').addEventListener('click',resetTransactionForm);
async function showApp(){$('loginPanel').classList.add('hidden');$('appPanel').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');await loadCategories();await loadTransactions();subscribeCategories()}
function showLogin(){if(categoryChannel&&db){db.removeChannel(categoryChannel);categoryChannel=null}$('appPanel').classList.add('hidden');$('loginPanel').classList.remove('hidden');$('logoutBtn').classList.add('hidden')}

async function loadCategories(){
 if(!db)return;
 const {data,error}=await db.from('categories').select('id,transaction_type,name').order('name',{ascending:true});
 if(error){setMessage('categoryMessage','មិនអាចផ្ទុកប្រភេទបាន៖ '+error.message,true);return}
 allCategories=data||[];renderCategoryOptions();renderCategoryRows();
}
function renderCategoryOptions(){
 const type=$('type').value;const current=$('category').value;
 const options=allCategories.filter(c=>c.transaction_type===type);
 $('category').innerHTML='<option value="">ជ្រើសរើសប្រភេទ</option>'+options.map(c=>'<option value="'+escapeHtml(c.name)+'">'+escapeHtml(c.name)+'</option>').join('');
 if(options.some(c=>c.name===current))$('category').value=current;
 const filter=$('transactionCategoryFilter');
 if(filter){
  const selected=filter.value;
  filter.innerHTML='<option value="">គ្រប់ប្រភេទ</option>'+allCategories.map(c=>'<option value="'+escapeHtml(c.name)+'">'+escapeHtml(c.name)+(c.transaction_type==='income'?' · ចំណូល':' · ចំណាយ')+'</option>').join('');
  if(allCategories.some(c=>c.name===selected))filter.value=selected;
 }
}
function renderCategoryRows(){
 const rows=allCategories;
 if(!rows.length){$('categoryRows').innerHTML='<span class="muted">មិនទាន់មានប្រភេទទេ។ សូមចុច បន្ថែមប្រភេទ។</span>';return}
 $('categoryRows').innerHTML=['income','expense'].map(type=>{
 const title=type==='income'?'ចំណូល':'ចំណាយ';
 const items=rows.filter(c=>c.transaction_type===type);
 return '<div class="category-group"><strong>'+title+'</strong><div class="category-chips">'+(items.length?items.map(c=>'<div class="category-chip"><span class="category-name">'+escapeHtml(c.name)+'</span><div class="category-actions"><button class="category-edit-btn" type="button" data-edit-category="'+c.id+'" aria-label="កែឈ្មោះ '+escapeHtml(c.name)+'" title="កែឈ្មោះប្រភេទ">កែ</button><button class="category-delete-btn" type="button" data-delete-category="'+c.id+'" aria-label="លុប '+escapeHtml(c.name)+'" title="លុបប្រភេទ">លុប</button></div></div>').join(''):'<span class="muted">មិនទាន់មាន</span>')+'</div></div>';
 }).join('');
}
async function addCategory(){
 const choice=prompt('សូមជ្រើសរើសប្រភេទដែលត្រូវបន្ថែម៖\n1. ប្រភេទចំណូល\n2. ប្រភេទចំណាយ','1');
 if(choice===null)return;
 const selected=choice.trim().toLowerCase();
 const normalized=selected==='1'||selected==='income'?'income':selected==='2'||selected==='expense'?'expense':null;
 if(!normalized){setMessage('categoryMessage','សូមជ្រើស 1 សម្រាប់ចំណូល ឬ 2 សម្រាប់ចំណាយ។',true);return}
 const name=prompt('បញ្ចូលឈ្មោះប្រភេទ'+(normalized==='income'?'ចំណូល':'ចំណាយ')+'ថ្មី៖');if(name===null)return;
 const clean=name.trim();if(!clean)return;
 const {error}=await db.from('categories').insert({transaction_type:normalized,name:clean});
 if(error){setMessage('categoryMessage',error.code==='23505'?'ប្រភេទនេះមានរួចហើយ។':error.message,true);return}
 setMessage('categoryMessage','បានបន្ថែមប្រភេទ'+(normalized==='income'?'ចំណូល':'ចំណាយ')+'ថ្មីដោយជោគជ័យ។');await loadCategories();
}
async function handleCategoryAction(e){
 const edit=e.target.closest('[data-edit-category]');const del=e.target.closest('[data-delete-category]');
 if(edit){
  const item=allCategories.find(c=>c.id===edit.dataset.editCategory);if(!item)return;
  const name=prompt('កែឈ្មោះប្រភេទ៖',item.name);if(name===null)return;const clean=name.trim();if(!clean)return;
  const {error}=await db.from('categories').update({name:clean}).eq('id',item.id);
  if(error){setMessage('categoryMessage',error.message,true);return}
  setMessage('categoryMessage','បានកែឈ្មោះប្រភេទ។');await loadCategories();
 }
 if(del){
  const item=allCategories.find(c=>c.id===del.dataset.deleteCategory);if(!item)return;
  const {count,error:checkError}=await db.from('transactions').select('id',{count:'exact',head:true}).eq('transaction_type',item.transaction_type).eq('category',item.name);
  if(checkError){setMessage('categoryMessage',checkError.message,true);return}
  if(count>0){setMessage('categoryMessage','មិនអាចលុបបានទេ ព្រោះប្រភេទនេះមានក្នុងប្រវត្តិប្រតិបត្តិការ។',true);return}
  if(!confirm('តើអ្នកចង់លុបប្រភេទ «'+item.name+'» មែនទេ?'))return;
  const {error}=await db.from('categories').delete().eq('id',item.id);
  if(error){setMessage('categoryMessage',error.message,true);return}
  setMessage('categoryMessage','បានលុបប្រភេទ។');await loadCategories();
 }
}
function subscribeCategories(){
 if(!db||categoryChannel)return;
 categoryChannel=db.channel('family-finance-categories').on('postgres_changes',{event:'*',schema:'public',table:'categories'},()=>loadCategories()).subscribe();
}

async function loadTransactions(){if(!db)return;const {data,error}=await db.from('transactions').select('id,transaction_type,amount,currency,category,description,transaction_date').order('transaction_date',{ascending:false});if(error){$('transactionRows').innerHTML=`<tr><td colspan="4" class="empty">${escapeHtml(error.message)}</td></tr>`;return}allTransactions=data||[];renderDashboard()}

function exportMonthlyExcel(){
 const month=$('monthFilter').value;
 if(!month){setMessage('exportMessage','សូមជ្រើសរើសខែជាមុនសិន។',true);return}
 if(!window.XLSX){setMessage('exportMessage','មិនអាចផ្ទុកមុខងារ Excel បានទេ។ សូម Refresh ទំព័រ ហើយសាកល្បងម្ដងទៀត។',true);return}
 const rows=allTransactions.filter(x=>(x.transaction_date||'').startsWith(month));
 if(!rows.length){setMessage('exportMessage','មិនមានប្រតិបត្តិការក្នុងខែនេះសម្រាប់ Export ទេ។',true);return}
 const income=rows.filter(x=>x.transaction_type==='income').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const expense=rows.filter(x=>x.transaction_type==='expense').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const summaryData=[
  ['FAMILY FINANCE - MONTHLY REPORT'],
  ['ខែរបាយការណ៍',month],
  ['រូបិយប័ណ្ណ','KHR (៛)'],
  [],
  ['សូចនាករ','ចំនួនទឹកប្រាក់'],
  ['ចំណូលសរុប',income],
  ['ចំណាយសរុប',expense],
  ['សមតុល្យសុទ្ធ',income-expense],
  ['ចំនួនប្រតិបត្តិការ',rows.length],
  ['កាលបរិច្ឆេទ Export',localDate(new Date())]
 ];
 const detailRows=[['កាលបរិច្ឆេទ','ប្រភេទ','ប្រភេទចំណូល/ចំណាយ','កំណត់ចំណាំ','ចំនួនទឹកប្រាក់','រូបិយប័ណ្ណ']];
 rows.slice().sort((a,b)=>(a.transaction_date||'').localeCompare(b.transaction_date||'')).forEach(x=>{
  detailRows.push([x.transaction_date||'',x.transaction_type==='income'?'ចំណូល':'ចំណាយ',x.category||'',x.description||'',Number(x.amount)||0,x.currency||'KHR']);
 });
 const grouped={};
 rows.forEach(x=>{
  const type=x.transaction_type==='income'?'ចំណូល':'ចំណាយ';
  const category=x.category||'មិនបានកំណត់';
  const key=type+'::'+category;
  if(!grouped[key])grouped[key]={type,category,total:0,count:0};
  grouped[key].total+=Number(x.amount)||0;
  grouped[key].count+=1;
 });
 const categoryRows=[['ប្រភេទ','ប្រភេទចំណូល/ចំណាយ','ចំនួនទឹកប្រាក់','ចំនួនប្រតិបត្តិការ']];
 Object.values(grouped).sort((a,b)=>a.type.localeCompare(b.type)||a.category.localeCompare(b.category)).forEach(x=>categoryRows.push([x.type,x.category,x.total,x.count]));
 const wb=XLSX.utils.book_new();
 const summarySheet=XLSX.utils.aoa_to_sheet(summaryData);
 const detailSheet=XLSX.utils.aoa_to_sheet(detailRows);
 const categorySheet=XLSX.utils.aoa_to_sheet(categoryRows);
 summarySheet['!cols']=[{wch:28},{wch:22}];
 detailSheet['!cols']=[{wch:16},{wch:14},{wch:25},{wch:38},{wch:20},{wch:14}];
 categorySheet['!cols']=[{wch:14},{wch:28},{wch:22},{wch:22}];
 ['B6','B7','B8'].forEach(ref=>{if(summarySheet[ref])summarySheet[ref].z='#,##0 "៛"';});
 for(let r=2;r<=detailRows.length;r++){const cell=detailSheet['E'+r];if(cell)cell.z='#,##0 "៛"';}
 for(let r=2;r<=categoryRows.length;r++){const cell=categorySheet['C'+r];if(cell)cell.z='#,##0 "៛"';}
 detailSheet['!autofilter']={ref:'A1:F'+detailRows.length};
 categorySheet['!autofilter']={ref:'A1:D'+categoryRows.length};
 XLSX.utils.book_append_sheet(wb,summarySheet,'Summary');
 XLSX.utils.book_append_sheet(wb,detailSheet,'Transactions');
 XLSX.utils.book_append_sheet(wb,categorySheet,'By Category');
 wb.Props={Title:'Family Finance Monthly Report '+month,Subject:'Monthly income and expense report',Author:'Family Finance'};
 XLSX.writeFile(wb,'Family-Finance-'+month+'.xlsx',{compression:true});
 setMessage('exportMessage','បានបង្កើតរបាយការណ៍ Excel ប្រចាំខែ '+month+' ដោយជោគជ័យ។');
}


function exportMonthlyPdf(){
 const month=$('monthFilter').value;
 if(!month){setMessage('exportMessage','សូមជ្រើសរើសខែជាមុនសិន។',true);return}
 const rows=allTransactions.filter(x=>(x.transaction_date||'').startsWith(month));
 if(!rows.length){setMessage('exportMessage','មិនមានប្រតិបត្តិការក្នុងខែនេះសម្រាប់ Export ទេ។',true);return}
 const income=rows.filter(x=>x.transaction_type==='income').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const expense=rows.filter(x=>x.transaction_type==='expense').reduce((sum,x)=>sum+(Number(x.amount)||0),0);
 const grouped={};
 rows.forEach(x=>{
  const type=x.transaction_type==='income'?'ចំណូល':'ចំណាយ';
  const category=x.category||'មិនបានកំណត់';
  const key=type+'::'+category;
  if(!grouped[key])grouped[key]={type,category,total:0,count:0};
  grouped[key].total+=Number(x.amount)||0;
  grouped[key].count+=1;
 });
 const categoryRows=Object.values(grouped).sort((a,b)=>a.type.localeCompare(b.type)||a.category.localeCompare(b.category));
 const detailRows=rows.slice().sort((a,b)=>(a.transaction_date||'').localeCompare(b.transaction_date||''));
 const report=$('pdfReport');
 const detailHtml=detailRows.map(x=>'<tr><td>'+escapeHtml(x.transaction_date||'')+'</td><td>'+(x.transaction_type==='income'?'ចំណូល':'ចំណាយ')+'</td><td>'+escapeHtml(x.category||'')+'</td><td>'+escapeHtml(x.description||'—')+'</td><td class="number">'+money(x.amount)+'</td></tr>').join('');
 const categoryHtml=categoryRows.map(x=>'<tr><td>'+x.type+'</td><td>'+escapeHtml(x.category)+'</td><td class="number">'+money(x.total)+'</td><td class="number">'+x.count+'</td></tr>').join('');
 report.innerHTML=
  '<header class="pdf-header">'+
   '<div class="pdf-brand">家 <span>Family Finance</span></div>'+
   '<h1>របាយការណ៍ចំណូល និងចំណាយប្រចាំខែ</h1>'+
   '<p>ខែរបាយការណ៍៖ <strong>'+escapeHtml(month)+'</strong></p>'+
   '<p>រូបិយប័ណ្ណ៖ KHR (៛) · កាលបរិច្ឆេទបង្កើត៖ '+escapeHtml(localDate(new Date()))+'</p>'+
  '</header>'+
  '<section class="pdf-section"><h2>១. សង្ខេបហិរញ្ញវត្ថុ (Summary)</h2>'+
   '<div class="pdf-summary">'+
    '<div><span>ចំណូលសរុប</span><strong class="pdf-income">'+money(income)+'</strong></div>'+
    '<div><span>ចំណាយសរុប</span><strong class="pdf-expense">'+money(expense)+'</strong></div>'+
    '<div><span>សមតុល្យសុទ្ធ</span><strong>'+money(income-expense)+'</strong></div>'+
    '<div><span>ចំនួនប្រតិបត្តិការ</span><strong>'+rows.length+'</strong></div>'+
   '</div></section>'+
  '<section class="pdf-section"><h2>២. ប្រវត្តិប្រតិបត្តិការ (Transactions)</h2>'+
   '<table class="pdf-table"><thead><tr><th>កាលបរិច្ឆេទ</th><th>ប្រភេទ</th><th>ប្រភេទចំណូល/ចំណាយ</th><th>កំណត់ចំណាំ</th><th class="number">ចំនួនទឹកប្រាក់</th></tr></thead><tbody>'+detailHtml+'</tbody></table></section>'+
  '<section class="pdf-section"><h2>៣. សង្ខេបតាមប្រភេទ (By Category)</h2>'+
   '<table class="pdf-table"><thead><tr><th>ប្រភេទ</th><th>ឈ្មោះប្រភេទ</th><th class="number">ចំនួនទឹកប្រាក់</th><th class="number">ចំនួនប្រតិបត្តិការ</th></tr></thead><tbody>'+categoryHtml+'</tbody></table></section>'+
  '<footer class="pdf-footer">Family Finance · របាយការណ៍សម្រាប់ប្រើប្រាស់ក្នុងគ្រួសារ</footer>';
 const oldTitle=document.title;
 report.classList.remove('hidden');
 document.title='Family-Finance-'+month;
 setMessage('exportMessage','សូមជ្រើសរើស “Save as PDF” ក្នុងផ្ទាំង Print ដើម្បីរក្សាទុករបាយការណ៍។');
 try{window.print()}catch(error){setMessage('exportMessage','មិនអាចបើកផ្ទាំង Print បានទេ៖ '+error.message,true)}
 report.classList.add('hidden');
 document.title=oldTitle;
}

function renderDashboard(){const month=$('monthFilter').value;const rows=allTransactions.filter(x=>!month||(x.transaction_date||'').startsWith(month));const income=rows.filter(x=>x.transaction_type==='income').reduce((s,x)=>s+Number(x.amount),0);const expense=rows.filter(x=>x.transaction_type==='expense').reduce((s,x)=>s+Number(x.amount),0);$('incomeTotal').textContent=money(income);$('expenseTotal').textContent=money(expense);$('balanceTotal').textContent=money(income-expense);$('monthIncome').textContent=money(income);$('monthExpense').textContent=money(expense);$('monthBalance').textContent=money(income-expense);$('recordCount').textContent=rows.length+' ប្រតិបត្តិការ';renderChart(rows);renderRows(rows)}
function renderChart(rows){if(!window.Chart)return;const grouped={};rows.forEach(x=>{const d=x.transaction_date||'';const key=d.slice(0,10);if(!grouped[key])grouped[key]={income:0,expense:0};grouped[key][x.transaction_type==='income'?'income':'expense']+=Number(x.amount)||0});const labels=Object.keys(grouped).sort();const income=labels.map(k=>grouped[k].income),expense=labels.map(k=>grouped[k].expense);if(chart)chart.destroy();chart=new Chart($('financeChart'),{type:'bar',data:{labels,datasets:[{label:'ចំណូល',data:income,backgroundColor:'#159574',borderRadius:6},{label:'ចំណាយ',data:expense,backgroundColor:'#e47768',borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.dataset.label+': '+money(c.raw)}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>new Intl.NumberFormat('km-KH',{notation:'compact'}).format(v)}}}}})}
function renderRows(rows){
 const query=$('transactionSearch').value.trim().toLowerCase();
 const type=$('transactionTypeFilter').value;
 const category=$('transactionCategoryFilter').value;
 const from=$('dateFromFilter').value;
 const to=$('dateToFilter').value;
 const filtered=rows.filter(x=>{
  const searchable=[x.category,x.description,x.amount,x.transaction_type].join(' ').toLowerCase();
  return (!query||searchable.includes(query))&&(!type||x.transaction_type===type)&&(!category||x.category===category)&&(!from||x.transaction_date>=from)&&(!to||x.transaction_date<=to);
 });
 const incomeTotal=filtered.filter(x=>x.transaction_type==='income').reduce((s,x)=>s+(Number(x.amount)||0),0);
 const expenseTotal=filtered.filter(x=>x.transaction_type==='expense').reduce((s,x)=>s+(Number(x.amount)||0),0);
 const netTotal=incomeTotal-expenseTotal;
 $('transactionSummary').innerHTML='<article class="search-total income"><span>ចំណូលសរុប</span><strong>'+money(incomeTotal)+'</strong></article><article class="search-total expense"><span>ចំណាយសរុប</span><strong>'+money(expenseTotal)+'</strong></article><article class="search-total balance"><span>សមតុល្យសុទ្ធ</span><strong>'+money(netTotal)+'</strong></article><article class="search-total count"><span>ចំនួនប្រតិបត្តិការ</span><strong>'+filtered.length+' ប្រតិបត្តិការ</strong></article>';
 if(!filtered.length){$('transactionRows').innerHTML='<tr><td colspan="4" class="empty">រកមិនឃើញប្រតិបត្តិការដែលត្រូវនឹងលក្ខខណ្ឌស្វែងរកទេ</td></tr>';return}
 $('transactionRows').innerHTML=filtered.slice(0,100).map(x=>`<tr><td>${escapeHtml(x.transaction_date||'')}</td><td><strong>${escapeHtml(x.category)}</strong><br><span class="muted">${escapeHtml(x.description||(x.transaction_type==='income'?'ចំណូល':'ចំណាយ'))}</span></td><td class="${x.transaction_type==='income'?'amount-in':'amount-out'}">${x.transaction_type==='income'?'+':'−'}${money(x.amount)}</td><td><button class="edit" data-edit="${x.id}" aria-label="កែប្រែ">កែ</button> <button class="delete" data-delete="${x.id}" aria-label="លុប">លុប</button></td></tr>`).join('');
}
function startEditTransaction(id){const item=allTransactions.find(x=>x.id===id);if(!item)return;editingTransactionId=id;$('type').value=item.transaction_type;renderCategoryOptions();$('category').value=item.category;$('amount').value=item.amount;$('date').value=item.transaction_date||localDate(new Date());$('description').value=item.description||'';$('transactionForm').querySelector('button[type="submit"]').textContent='រក្សាទុកការកែប្រែ';$('cancelEditBtn').classList.remove('hidden');setMessage('formMessage','កំពុងកែប្រែប្រតិបត្តិការ...');$('transactionForm').scrollIntoView({behavior:'smooth',block:'center'})}
function resetTransactionForm(){editingTransactionId=null;$('transactionForm').reset();$('date').value=localDate(new Date());renderCategoryOptions();$('transactionForm').querySelector('button[type="submit"]').textContent='＋ រក្សាទុកទិន្នន័យ';$('cancelEditBtn').classList.add('hidden');setMessage('formMessage','')}
['transactionSearch','transactionTypeFilter','transactionCategoryFilter','dateFromFilter','dateToFilter'].forEach(id=>$(id).addEventListener(id==='transactionSearch'?'input':'change',()=>renderDashboard()));
$('transactionRows').addEventListener('click',async e=>{const edit=e.target.closest('[data-edit]');if(edit){startEditTransaction(edit.dataset.edit);return}const b=e.target.closest('[data-delete]');if(!b||!confirm('តើអ្នកប្រាកដថាចង់លុបទិន្នន័យនេះមែនទេ?'))return;const {error}=await db.from('transactions').delete().eq('id',b.dataset.delete);if(error)alert(error.message);else await loadTransactions()});
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
if(db){db.auth.getSession().then(({data})=>{if(data.session)showApp()});db.auth.onAuthStateChange((_event,session)=>{if(session)showApp();else showLogin()})}


// Backup & Restore: browser-side JSON export/import for authenticated family data.
const BACKUP_VERSION = 1;
const BACKUP_TABLES = {
 family_members: ['id','name','relationship','created_at'],
 categories: ['id','transaction_type','name','created_at'],
 savings_goals: ['id','title','target_amount','saved_amount','currency','target_date','created_at'],
 app_settings: ['id','setting_key','setting_value','updated_at'],
 transactions: ['id','transaction_type','amount','currency','category','description','transaction_date','member_id','created_at']
};
let selectedBackupPayload = null;

async function readAllBackupRows(table){
 const pageSize=500, rows=[];
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await db.from(table).select('*').order('id',{ascending:true}).range(offset,offset+pageSize-1);
  if(error)throw new Error(table+': '+error.message);
  rows.push(...(data||[]));
  if(!data||data.length<pageSize)break;
 }
 return rows;
}
async function createBackupPayload(){
 const tables={};
 for(const table of Object.keys(BACKUP_TABLES))tables[table]=await readAllBackupRows(table);
 return {
  app:'Family Finance',
  format:'family-finance-backup',
  version:BACKUP_VERSION,
  exported_at:new Date().toISOString(),
  tables
 };
}
function downloadBackupPayload(payload,prefix='Family-Finance-Backup'){
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 const stamp=localDate(new Date())+'-'+new Date().toTimeString().slice(0,8).replace(/:/g,'');
 link.href=url;link.download=prefix+'-'+stamp+'.json';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportFullBackup(){
 if(!db){setMessage('backupMessage','សូមចូលគណនីគ្រួសារជាមុនសិន។',true);return}
 const button=$('backupNowBtn');button.disabled=true;setMessage('backupMessage','កំពុងប្រមូលទិន្នន័យគ្រួសារ...');
 try{
  const payload=await createBackupPayload();
  downloadBackupPayload(payload);
  const total=Object.values(payload.tables).reduce((sum,rows)=>sum+rows.length,0);
  setMessage('backupMessage','Backup បានជោគជ័យ! រក្សាទុក '+total+' កំណត់ត្រា ក្នុងឯកសារ JSON។');
 }catch(error){setMessage('backupMessage','Backup មិនបានជោគជ័យ៖ '+error.message,true)}
 finally{button.disabled=false}
}
function validateBackupPayload(payload){
 if(!payload||payload.format!=='family-finance-backup'||payload.app!=='Family Finance'||payload.version!==BACKUP_VERSION||!payload.tables||typeof payload.tables!=='object')throw new Error('ឯកសារនេះមិនមែនជា Family Finance Backup version ដែលគាំទ្រទេ។');
 for(const table of Object.keys(BACKUP_TABLES)){
  if(!Array.isArray(payload.tables[table]))throw new Error('ឯកសារមិនមានបញ្ជីទិន្នន័យ '+table+' ត្រឹមត្រូវទេ។');
  const fields=BACKUP_TABLES[table];
  payload.tables[table].forEach((row,index)=>{
   if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('ទិន្នន័យ '+table+' លេខ '+(index+1)+' មិនត្រឹមត្រូវទេ។');
   if(!row.id)throw new Error('ទិន្នន័យ '+table+' លេខ '+(index+1)+' ខ្វះ ID។');
   for(const key of Object.keys(row))if(!fields.includes(key))throw new Error('ឯកសារមានវាលមិនស្គាល់ ('+table+'.'+key+')។');
  });
 }
}
function showBackupPreview(payload,fileName){
 const counts=Object.entries(BACKUP_TABLES).map(([table])=>'<li><span>'+escapeHtml(table)+'</span><strong>'+payload.tables[table].length+'</strong></li>').join('');
 $('restorePreview').innerHTML='<strong>ឯកសារ៖ '+escapeHtml(fileName)+'</strong><ul>'+counts+'</ul><p>បង្កើតនៅ៖ '+escapeHtml(payload.exported_at||'មិនបានបញ្ជាក់')+'</p><p class="muted">ទិន្នន័យនឹងត្រូវ Merge/Update តាម ID។ ទិន្នន័យបច្ចុប្បន្នដែលមិនមានក្នុងឯកសារនេះនឹងមិនត្រូវបានលុបទេ។</p>';
 $('restorePreview').classList.remove('hidden');
 $('restoreNowBtn').classList.remove('hidden');$('restoreNowBtn').disabled=false;
}
async function handleBackupFileChange(event){
 selectedBackupPayload=null;$('restoreNowBtn').disabled=true;$('restoreNowBtn').classList.add('hidden');$('restorePreview').classList.add('hidden');
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>25*1024*1024){setMessage('backupMessage','ឯកសារធំពេក (កំណត់អតិបរមា 25 MB)។',true);return}
 try{
  const payload=JSON.parse(await file.text());
  validateBackupPayload(payload);
  selectedBackupPayload=payload;showBackupPreview(payload,file.name);
  setMessage('backupMessage','បានអានឯកសារ Backup ដោយជោគជ័យ។ សូមពិនិត្យចំនួនទិន្នន័យមុន Restore។');
 }catch(error){setMessage('backupMessage','មិនអាចប្រើឯកសារនេះបានទេ៖ '+error.message,true)}
}
function backupRowsForRestore(table,rows){
 const fields=BACKUP_TABLES[table];
 return rows.map(row=>Object.fromEntries(fields.filter(key=>Object.prototype.hasOwnProperty.call(row,key)).map(key=>[key,row[key]])));
}
async function upsertBackupTable(table,rows){
 const batchSize=200;
 const conflict={
  family_members:'id',
  categories:'transaction_type,name',
  savings_goals:'id',
  app_settings:'setting_key',
  transactions:'id'
 }[table];
 for(let i=0;i<rows.length;i+=batchSize){
  const batch=backupRowsForRestore(table,rows.slice(i,i+batchSize));
  const {error}=await db.from(table).upsert(batch,{onConflict:conflict});
  if(error)throw new Error(table+': '+error.message);
 }
}
async function restoreBackup(){
 if(!db||!selectedBackupPayload)return;
 validateBackupPayload(selectedBackupPayload);
 const total=Object.values(selectedBackupPayload.tables).reduce((sum,rows)=>sum+rows.length,0);
 if(!confirm('តើអ្នកប្រាកដថាចង់ Restore '+total+' កំណត់ត្រាមែនទេ? ប្រព័ន្ធនឹងទាញយក Backup ទិន្នន័យបច្ចុប្បន្នជាមុន។'))return;
 const button=$('restoreNowBtn');button.disabled=true;$('backupNowBtn').disabled=true;
 try{
  setMessage('backupMessage','កំពុងបង្កើត Backup ទិន្នន័យបច្ចុប្បន្ន មុន Restore...');
  const safetyCopy=await createBackupPayload();
  downloadBackupPayload(safetyCopy,'Family-Finance-Before-Restore');
  const order=['family_members','categories','savings_goals','app_settings','transactions'];
  for(const table of order){
   setMessage('backupMessage','កំពុង Restore '+table+'...');
   await upsertBackupTable(table,selectedBackupPayload.tables[table]);
  }
  await loadCategories();await loadTransactions();
  setMessage('backupMessage','Restore បានជោគជ័យ! បានបញ្ចូល/ធ្វើបច្ចុប្បន្នភាព '+total+' កំណត់ត្រា។ សូមពិនិត្យទិន្នន័យក្នុង Dashboard។');
 }catch(error){
  setMessage('backupMessage','Restore មិនបានបញ្ចប់ទេ៖ '+error.message+'។ ទិន្នន័យដែលបានអនុវត្តមុនកំហុសអាចនៅមាន។ សូមពិនិត្យ ហើយសាកល្បងម្ដងទៀត។',true);
 }finally{$('backupNowBtn').disabled=false;button.disabled=false}
}
$('backupNowBtn').addEventListener('click',exportFullBackup);
$('restoreFile').addEventListener('change',handleBackupFileChange);
$('restoreNowBtn').addEventListener('click',restoreBackup);
