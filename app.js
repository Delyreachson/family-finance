// Family Finance - Supabase connection settings
const SUPABASE_URL = 'https://ludrupofaaeqmqzvhvox.supabase.co';
// Paste the project's publishable key here (Project Settings > API Keys).
// NEVER use a service_role or secret key in a browser app.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wk15NsgFvDCkZbUuHVeyWg_YEHveiFp';

const $ = (id) => document.getElementById(id);
const configured = SUPABASE_URL.startsWith('https://') && SUPABASE_PUBLISHABLE_KEY !== 'PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE' && SUPABASE_PUBLISHABLE_KEY.length > 20;
let db = null;
if (configured && window.supabase?.createClient) db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const money = (value) => new Intl.NumberFormat('km-KH',{maximumFractionDigits:0}).format(Number(value)||0) + ' ៛';
const setMessage = (id, message, error=false) => { const el=$(id); el.textContent=message; el.classList.toggle('error',error); };
$('date').value = new Date().toISOString().slice(0,10);
if (!configured) $('setupNotice').classList.remove('hidden');

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!db) return setMessage('loginMessage','សូមបញ្ចូល Publishable Key ក្នុង app.js ជាមុនសិន។',true);
  setMessage('loginMessage','កំពុងពិនិត្យគណនី...');
  const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
  if(error) return setMessage('loginMessage',error.message,true);
  await showApp();
});
$('logoutBtn').addEventListener('click', async()=>{if(db) await db.auth.signOut(); showLogin();});
$('refreshBtn').addEventListener('click',loadTransactions);
$('transactionForm').addEventListener('submit',async(event)=>{
  event.preventDefault(); if(!db) return;
  setMessage('formMessage','កំពុងរក្សាទុក...');
  const payload={transaction_type:$('type').value,amount:Number($('amount').value),currency:'KHR',category:$('category').value.trim(),description:$('description').value.trim()||null,transaction_date:$('date').value};
  const {error}=await db.from('transactions').insert(payload);
  if(error) return setMessage('formMessage',error.message,true);
  $('transactionForm').reset(); $('date').value=new Date().toISOString().slice(0,10); setMessage('formMessage','បានរក្សាទុកទិន្នន័យដោយជោគជ័យ។'); await loadTransactions();
});

async function showApp(){ $('loginPanel').classList.add('hidden'); $('appPanel').classList.remove('hidden'); $('logoutBtn').classList.remove('hidden'); await loadTransactions(); }
function showLogin(){ $('appPanel').classList.add('hidden'); $('loginPanel').classList.remove('hidden'); $('logoutBtn').classList.add('hidden'); }
async function loadTransactions(){
  if(!db) return;
  const {data,error}=await db.from('transactions').select('id,transaction_type,amount,currency,category,description,transaction_date').order('transaction_date',{ascending:false}).limit(100);
  if(error){$('transactionRows').innerHTML=`<tr><td colspan="4" class="empty">${escapeHtml(error.message)}</td></tr>`;return;}
  const rows=data||[]; const income=rows.filter(x=>x.transaction_type==='income').reduce((s,x)=>s+Number(x.amount),0); const expense=rows.filter(x=>x.transaction_type==='expense').reduce((s,x)=>s+Number(x.amount),0);
  $('incomeTotal').textContent=money(income); $('expenseTotal').textContent=money(expense); $('balanceTotal').textContent=money(income-expense);
  if(!rows.length){$('transactionRows').innerHTML='<tr><td colspan="4" class="empty">មិនទាន់មានទិន្នន័យ</td></tr>';return;}
  $('transactionRows').innerHTML=rows.map(x=>`<tr><td>${escapeHtml(x.transaction_date||'')}</td><td><strong>${escapeHtml(x.category)}</strong><br><span class="muted">${escapeHtml(x.description|| (x.transaction_type==='income'?'ចំណូល':'ចំណាយ'))}</span></td><td class="${x.transaction_type==='income'?'amount-in':'amount-out'}">${x.transaction_type==='income'?'+':'−'}${money(x.amount)}</td><td><button class="delete" data-delete="${x.id}" aria-label="លុប">លុប</button></td></tr>`).join('');
}
$('transactionRows').addEventListener('click',async(event)=>{const btn=event.target.closest('[data-delete]');if(!btn||!confirm('តើអ្នកប្រាកដថាចង់លុបទិន្នន័យនេះមែនទេ?'))return;const {error}=await db.from('transactions').delete().eq('id',btn.dataset.delete);if(error)alert(error.message);else await loadTransactions();});
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
if(db){db.auth.getSession().then(({data})=>{if(data.session)showApp();});db.auth.onAuthStateChange((_event,session)=>{if(session)showApp();});}
