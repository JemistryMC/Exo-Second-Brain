const SUPABASE_URL = 'https://tnqlqsjyncfcanlzewao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWxxc2p5bmNmY2FubHpld2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzYxNTUsImV4cCI6MjA5NTcxMjE1NX0.e9xfEINP-Jnf1NTV7lvayeIk4ZVxLSanYjuAwzt41ZY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null; 
let taskToShiftId = null; 
let taskToEditId = null; 
let taskToSplitId = null; 
let currentBlocks = []; 
let futureBlocks = []; 
let userCategories = []; 
let myChart = null; 

// === نظام النوافذ المنبثقة المخصص (Custom Alerts & Confirms) ===

function showNeoAlert(title, message, type = 'normal') {
    const modal = document.getElementById('neo-alert-modal');
    const titleEl = document.getElementById('neo-alert-title');
    const msgEl = document.getElementById('neo-alert-message');
    const btn = document.getElementById('neo-alert-btn');

    titleEl.innerText = title;
    msgEl.innerText = message;

    if (type === 'danger') {
        titleEl.style.color = 'var(--danger)';
        btn.className = 'neo-btn danger full-width';
    } else if (type === 'success') {
        titleEl.style.color = '#10b981';
        btn.className = 'neo-btn primary full-width'; 
        btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    } else {
        titleEl.style.color = 'var(--accent)';
        btn.className = 'neo-btn primary full-width';
        btn.style.background = ''; // العودة للتصميم الافتراضي
    }

    modal.style.display = 'flex';
}

let confirmActionCallback = null;
function showNeoConfirm(title, message, onConfirm) {
    const titleEl = document.getElementById('neo-confirm-title');
    titleEl.innerText = title;
    
    // التمييز اللوني على حسب إن كان الحذف خطر
    if(title.includes('حذف') || title.includes('خروج')) {
        titleEl.style.color = 'var(--danger)';
        document.getElementById('neo-confirm-btn').className = 'neo-btn danger flex-1';
    } else {
        titleEl.style.color = 'var(--accent)';
        document.getElementById('neo-confirm-btn').className = 'neo-btn primary flex-1';
    }

    document.getElementById('neo-confirm-message').innerText = message;
    confirmActionCallback = onConfirm;
    document.getElementById('neo-confirm-modal').style.display = 'flex';
}

document.getElementById('neo-confirm-btn').addEventListener('click', () => {
    if(confirmActionCallback) confirmActionCallback();
    closeModal('neo-confirm-modal');
});


// === الأدوات المساعدة ===
function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function escapeHTML(str) {
    if(!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag]));
}

async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    currentUser = session.user;
    
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('ar-EG', options);
    
    await loadCategories();
    
    if (userCategories.length > 0) {
        await loadStatsAndTasks();
        await checkWeeklyReview(); 
    }
}

// === منطق شاشة الاستقبال (Onboarding) ===
let onboardingCats = [];
const presetCats = [
    { name: 'العمل', icon: '💼', color: '#4facfe' },
    { name: 'الدراسة', icon: '📚', color: '#10b981' },
    { name: 'الرياضة', icon: '🏋️', color: '#f59e0b' },
    { name: 'القراءة', icon: '📖', color: '#8b5cf6' },
    { name: 'البرمجة', icon: '💻', color: '#ef4444' },
    { name: 'مهام عامة', icon: '📌', color: '#a1a1aa' }
];

async function checkWeeklyReview() {
    const today = new Date();
    if (today.getDay() === 5) { // 5 = الجمعة
        const localDate = getLocalDate();
        const { data } = await supabaseClient.from('weekly_reviews').select('*').eq('user_id', currentUser.id).eq('review_date', localDate);
        if(!data || data.length === 0) {
            document.getElementById('weekly-review-modal').style.display = 'flex';
        }
    }
}

function setRating(stars) {
    document.getElementById('review-rating').value = stars;
    const starSpans = document.getElementById('rating-stars').children;
    for(let i=0; i<5; i++) {
        starSpans[i].classList.toggle('active', i < stars);
    }
}

async function submitWeeklyReview() {
    const rating = document.getElementById('review-rating').value;
    const notes = document.getElementById('review-notes').value.trim();
    if (rating == 0) return showNeoAlert('خطوة ناقصة', 'يا ريت تختار تقييم بالنجوم الأول قبل الحفظ.', 'danger');
    
    const btn = document.getElementById('review-btn');
    btn.innerText = 'جاري الحفظ...'; btn.disabled = true;
    
    const reviewData = { user_id: currentUser.id, review_date: getLocalDate(), rating, notes: escapeHTML(notes) };
    await supabaseClient.from('weekly_reviews').insert([reviewData]);
    
    closeModal('weekly-review-modal');
    showNeoAlert('تم الحفظ 🌟', 'عاش جداً.. نتمنى لك أسبوع جديد مليان إنجاز!', 'success');
}

async function loadCategories() {
    let { data: categories } = await supabaseClient.from('user_categories').select('*').eq('user_id', currentUser.id);
    
    if (!categories || categories.length === 0) {
        document.getElementById('onboarding-modal').style.display = 'flex';
        renderOnboardingPresets();
        return; 
    }
    
    userCategories = categories;
    updateCategoryDropdown('task-category'); updateCategoryDropdown('edit-task-category');
    renderCategoryList();
}

function renderOnboardingPresets() {
    const container = document.getElementById('onboarding-presets');
    let presetsHTML = '';
    presetCats.forEach(cat => {
        presetsHTML += `<button class="neo-btn secondary" style="padding: 8px 12px; font-size: 13px;" onclick="selectOnboardingPreset('${cat.name}', '${cat.icon}', '${cat.color}')">${cat.icon} ${cat.name}</button>`;
    });
    container.innerHTML = presetsHTML;
}

function selectOnboardingPreset(name, icon, color) {
    if(!onboardingCats.find(c => c.name === name)) {
        onboardingCats.push({name, icon, color});
        renderSelectedOnboardingCats();
    }
}

function addCustomOnboardingCat() {
    const name = escapeHTML(document.getElementById('ob-cat-name').value.trim());
    const icon = escapeHTML(document.getElementById('ob-cat-icon').value.trim()) || '🎯';
    const color = document.getElementById('ob-cat-color').value;
    if(name && !onboardingCats.find(c => c.name === name)) {
        onboardingCats.push({name, icon, color});
        renderSelectedOnboardingCats();
        document.getElementById('ob-cat-name').value = '';
    }
}

function removeOnboardingCat(index) {
    onboardingCats.splice(index, 1);
    renderSelectedOnboardingCats();
}

function renderSelectedOnboardingCats() {
    const container = document.getElementById('ob-selected-cats');
    let obHTML = '';
    onboardingCats.forEach((cat, idx) => {
        obHTML += `
            <div class="cat-item" style="border-right-color: ${cat.color}; padding: 10px; margin-bottom: 5px;">
                <span style="font-weight: 600; color: #fff; font-size: 13px;">${cat.icon} &nbsp; ${cat.name}</span>
                <button class="del-cat-btn" onclick="removeOnboardingCat(${idx})" style="padding: 4px 8px;">حذف</button>
            </div>`;
    });
    container.innerHTML = obHTML;
}

async function completeOnboarding() {
    if(onboardingCats.length === 0) {
        showNeoAlert('بيانات ناقصة', 'معلش، لازم تختار أو تضيف تصنيف واحد على الأقل عشان نقدر نبدأ نظبطلك النظام.', 'danger');
        return;
    }
    
    const btn = document.getElementById('start-journey-btn');
    btn.innerText = 'جاري التجهيز... ⏳'; btn.disabled = true;

    const catsToInsert = onboardingCats.map(c => ({ user_id: currentUser.id, name: c.name, icon: c.icon, color: c.color }));
    await supabaseClient.from('user_categories').insert(catsToInsert);
    
    document.getElementById('onboarding-modal').style.display = 'none';
    
    userCategories = await supabaseClient.from('user_categories').select('*').eq('user_id', currentUser.id).then(res => res.data);
    updateCategoryDropdown('task-category'); updateCategoryDropdown('edit-task-category');
    renderCategoryList();
    
    await loadStatsAndTasks();
    await checkWeeklyReview();
}

function updateCategoryDropdown(elementId) {
    const select = document.getElementById(elementId);
    if(!select) return;
    select.innerHTML = '';
    userCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name; option.innerText = `${cat.icon} ${cat.name}`;
        select.appendChild(option);
    });
}

function renderCategoryList() {
    const list = document.getElementById('categories-list');
    let catsHTML = '';
    userCategories.forEach(cat => {
        catsHTML += `<div class="cat-item" style="border-right-color: ${cat.color}"><span style="font-weight: 600; color: #fff;">${cat.icon} &nbsp; ${escapeHTML(cat.name)}</span><button class="del-cat-btn" onclick="deleteCategory('${cat.id}')">حذف</button></div>`;
    });
    list.innerHTML = catsHTML;
}

async function addNewCategory() {
    const name = escapeHTML(document.getElementById('new-cat-name').value.trim());
    const icon = escapeHTML(document.getElementById('new-cat-icon').value.trim()) || '📌';
    const color = document.getElementById('new-cat-color').value;
    if (!name) return;
    const { data } = await supabaseClient.from('user_categories').insert([{ user_id: currentUser.id, name, icon, color }]).select();
    if (data) { userCategories.push(data[0]); updateCategoryDropdown('task-category'); updateCategoryDropdown('edit-task-category'); renderCategoryList(); document.getElementById('new-cat-name').value = ''; }
}

async function deleteCategory(id) {
    showNeoConfirm('حذف التصنيف 🗑️', 'هل أنت متأكد إنك عايز تحذف التصنيف ده؟', async () => {
        await supabaseClient.from('user_categories').delete().eq('id', id);
        userCategories = userCategories.filter(c => c.id !== id);
        updateCategoryDropdown('task-category'); updateCategoryDropdown('edit-task-category'); renderCategoryList();
    });
}

async function loadStatsAndTasks() {
    const today = getLocalDate();
    const { data: stats } = await supabaseClient.from('user_stats').select('*').eq('id', currentUser.id).single();
    if (stats) document.getElementById('streak-display').innerText = `🔥 ${stats.current_streak}`;

    let { data: blocks } = await supabaseClient.from('daily_blocks').select('*').gte('scheduled_date', today).order('scheduled_date', { ascending: true }).order('created_at', { ascending: true });
    const allBlocks = blocks || [];
    currentBlocks = allBlocks.filter(b => b.scheduled_date === today);
    futureBlocks = allBlocks.filter(b => b.scheduled_date > today);
    renderBlocks();
}

function updateProgressRing() {
    const circle = document.getElementById('progress-circle'); const text = document.getElementById('progress-text');
    const radius = circle.r.baseVal.value; const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    if(currentBlocks.length === 0) { circle.style.strokeDashoffset = circumference; text.innerText = '0%'; return; }
    const completed = currentBlocks.filter(b => b.is_completed).length;
    const percentage = Math.round((completed / currentBlocks.length) * 100);
    circle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
    text.innerText = percentage === 100 ? '✅' : `${percentage}%`;
}

function generateTaskHTML(block, isFuture = false) {
    const catData = userCategories.find(c => c.name === block.category) || { icon: '📌', color: '#a1a1aa' };
    const completedClass = block.is_completed ? 'completed' : '';
    const pinnedClass = block.is_pinned && !isFuture ? 'pinned' : '';
    const safeTitle = escapeHTML(block.title);
    
    const shiftWarnings = block.shift_count >= 3 ? `<span class="danger-text">⚠️ تم التأجيل ${block.shift_count} مرات! (ينصح بالتقسيم)</span>` : '';
    const shiftDangerClass = block.shift_count >= 3 ? 'shift-danger' : '';

    let actionsHTML = block.is_completed ? 
        `<span style="color: #4facfe; font-size: 12px; font-weight: 600;">عاش! تم الإنجاز 👏</span>
         <button class="icon-action-btn delete-btn" onclick="deleteTask('${block.id}')" title="حذف">🗑️</button>` : 
        `<button class="icon-action-btn ${block.is_pinned ? 'active-pin' : ''}" onclick="togglePin('${block.id}', ${!block.is_pinned}, ${isFuture})" title="تثبيت المهمة لفوق">📌</button>
         <button class="icon-action-btn" onclick="openEditModal('${block.id}')" title="تعديل">✏️</button>
         ${!isFuture ? `<button class="shift-text-btn ${shiftDangerClass}" onclick="openShiftModal('${block.id}')">تأجيل</button>` : ''}
         <button class="shift-text-btn" onclick="openSplitModal('${block.id}')" style="background: rgba(16, 185, 129, 0.1); color: #10b981; margin-right: 4px;">تقسيم</button>
         <button class="icon-action-btn delete-btn" onclick="deleteTask('${block.id}')" title="حذف">🗑️</button>`;
         
    const dateBadge = isFuture ? `<span class="future-badge">📅 ${block.scheduled_date}</span>` : '';

    return `
        <div class="task-card ${completedClass} ${pinnedClass}" id="block-${block.id}" style="border-right-color: ${catData.color}">
            <div class="task-content-wrapper">
                <label class="custom-checkbox"><input type="checkbox" ${block.is_completed ? 'checked' : ''} onchange="toggleBlock('${block.id}', this.checked, ${isFuture})"><span class="checkmark"></span></label>
                <div class="task-details">
                    <h3 class="task-title">${safeTitle}</h3>
                    <div class="task-meta"><span style="color: ${catData.color}">${catData.icon} ${block.category}</span><span>&bull;</span><span>${block.task_time}</span>${dateBadge}</div>
                    ${!isFuture ? shiftWarnings : ''}
                </div>
            </div>
            <div class="task-actions">${actionsHTML}</div>
        </div>
    `;
}

function renderBlocks() {
    currentBlocks.sort((a, b) => (b.is_pinned === a.is_pinned) ? 0 : b.is_pinned ? 1 : -1);

    const container = document.getElementById('blocks-container'); 
    if(currentBlocks.length === 0) { 
        container.innerHTML = '<div style="text-align: center; color: #a1a1aa; padding: 40px 20px; background: #18181b; border-radius: 16px; border: 1px dashed #3f3f46;">يومك رايق والسبورة فاضية.. استمتع بوقتك ✨</div>'; 
    } else { 
        // التعديل هنا: تجميع الكود في متغير أولاً لمنع اللاج
        let blocksHTML = '';
        currentBlocks.forEach(block => { blocksHTML += generateTaskHTML(block, false); }); 
        container.innerHTML = blocksHTML;
    }
    updateProgressRing(); 

    const futureWrapper = document.getElementById('future-blocks-wrapper');
    const futureContainer = document.getElementById('future-blocks-container');
    
    if(futureBlocks.length > 0) {
        futureWrapper.style.display = 'block';
        let futureHTML = '';
        futureBlocks.forEach(block => { futureHTML += generateTaskHTML(block, true); });
        futureContainer.innerHTML = futureHTML;
    } else { 
        futureWrapper.style.display = 'none'; 
        futureContainer.innerHTML = '';
    }
}

function toggleFutureTasks() {
    document.getElementById('future-blocks-container').classList.toggle('collapsed');
    document.getElementById('future-toggle-btn').classList.toggle('rotated');
}

async function togglePin(id, isPinned, isFuture) {
    const arr = isFuture ? futureBlocks : currentBlocks;
    const index = arr.findIndex(b => b.id === id);
    if(index > -1) arr[index].is_pinned = isPinned;
    renderBlocks();
    await supabaseClient.from('daily_blocks').update({ is_pinned: isPinned }).eq('id', id);
}

// تحويل الحذف للاستخدام مع النافذة الجديدة
function deleteTask(id) {
    showNeoConfirm('حذف المهمة 🗑️', 'هل أنت متأكد إنك عايز تمسح المهمة دي خالص؟', async () => {
        currentBlocks = currentBlocks.filter(b => b.id !== id); 
        futureBlocks = futureBlocks.filter(b => b.id !== id);
        renderBlocks();
        await supabaseClient.from('daily_blocks').delete().eq('id', id);
    });
}

function openEditModal(id) {
    taskToEditId = id;
    const block = currentBlocks.find(b => b.id === id) || futureBlocks.find(b => b.id === id);
    if(!block) return;
    document.getElementById('edit-task-title').value = block.title;
    const dateInput = document.getElementById('edit-task-date');
    dateInput.value = block.scheduled_date;
    dateInput.min = getLocalDate(); 
    document.getElementById('edit-task-category').value = block.category;
    document.getElementById('edit-task-time').value = ''; 
    document.getElementById('edit-modal').style.display = 'flex';
}

async function confirmEdit() {
    const newTitle = escapeHTML(document.getElementById('edit-task-title').value.trim());
    const newCategory = document.getElementById('edit-task-category').value;
    const newDate = document.getElementById('edit-task-date').value;
    const timeVal = document.getElementById('edit-task-time').value;
    
    if(!newTitle || !newDate) {
        showNeoAlert('بيانات ناقصة', 'يا ريت تتأكد من كتابة اسم المهمة واختيار التاريخ.', 'danger');
        return;
    }

    const block = currentBlocks.find(b => b.id === taskToEditId) || futureBlocks.find(b => b.id === taskToEditId);
    let formattedTime = block.task_time; 
    if(timeVal) {
        const [hour, min] = timeVal.split(':'); const h = parseInt(hour);
        const ampm = h >= 12 ? 'م' : 'ص'; const h12 = h % 12 || 12;
        formattedTime = `${h12}:${min} ${ampm}`;
    }

    const updates = { title: newTitle, category: newCategory, task_time: formattedTime, scheduled_date: newDate };
    document.querySelector('#edit-modal .primary').innerText = 'جاري الحفظ...';
    await supabaseClient.from('daily_blocks').update(updates).eq('id', taskToEditId);
    document.querySelector('#edit-modal .primary').innerText = 'حفظ التعديلات';
    
    closeModal('edit-modal'); await loadStatsAndTasks(); 
}

// === منطق ميزة تقسيم المهمة (Split Task Engine) ===
function openSplitModal(id) {
    taskToSplitId = id;
    const block = currentBlocks.find(b => b.id === id) || futureBlocks.find(b => b.id === id);
    if (!block) return;
    
    document.getElementById('split-task-parent-title').innerText = `هتفكك مهمة: ${block.title}`;
    
    const container = document.getElementById('subtasks-inputs-container');
    container.innerHTML = `
        <input type="text" class="neo-input full-width subtask-input" placeholder="الخطوة الأولى اللي هتبدأ بيها...">
        <input type="text" class="neo-input full-width subtask-input" placeholder="الخطوة التانية...">
    `;
    
    document.getElementById('split-modal').style.display = 'flex';
}

function addSubtaskInputField() {
    const container = document.getElementById('subtasks-inputs-container');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'neo-input full-width subtask-input';
    input.placeholder = 'الخطوة اللي بعدها...';
    container.appendChild(input);
}

async function confirmSplitTask() {
    const inputElements = document.getElementsByClassName('subtask-input');
    const subtaskTitles = [];
    for (let input of inputElements) {
        const val = escapeHTML(input.value.trim());
        if (val) subtaskTitles.push(val);
    }
    
    if (subtaskTitles.length === 0) {
        showNeoAlert('نسيت حاجة!', 'اكتب على الأقل خطوة واحدة صغيرة عشان نقسم المهمة الأساسية ليها.', 'danger');
        return;
    }
    
    const originalBlock = currentBlocks.find(b => b.id === taskToSplitId) || futureBlocks.find(b => b.id === taskToSplitId);
    if (!originalBlock) return;
    
    const btn = document.querySelector('#split-modal .primary');
    btn.disabled = true; btn.innerText = 'جاري التفتيت... ⏳';
    
    const newTasksToInsert = subtaskTitles.map(title => ({
        user_id: currentUser.id,
        title: title,
        category: originalBlock.category,
        scheduled_date: originalBlock.scheduled_date,
        is_completed: false,
        task_time: originalBlock.task_time,
        shift_count: 0,
        is_pinned: false
    }));
    
    const { error: insertError } = await supabaseClient.from('daily_blocks').insert(newTasksToInsert);
    if (insertError) {
        showNeoAlert('مشكلة في الخادم', 'للأسف حصل مشكلة وإحنا بنحفظ المهام المقسمة: ' + insertError.message, 'danger');
        btn.disabled = false; btn.innerText = 'قسّم وكسر الكسل 🚀';
        return;
    }
    
    await supabaseClient.from('daily_blocks').delete().eq('id', taskToSplitId);
    
    closeModal('split-modal');
    btn.disabled = false; btn.innerText = 'قسّم وكسر الكسل 🚀';
    
    await loadStatsAndTasks();
    showNeoAlert('تم بنجاح 🎯', 'المهة الكبيرة اتكسرت لخطوات صغيرة. يلا نبدأ في أول خطوة من غير تأجيل!', 'success');
}

async function toggleBlock(id, isCompleted, isFuture) {
    const item = document.getElementById(`block-${id}`);
    isCompleted ? item.classList.add('completed') : item.classList.remove('completed');
    if(isFuture) { const index = futureBlocks.findIndex(b => b.id === id); if(index > -1) futureBlocks[index].is_completed = isCompleted; } 
    else { const index = currentBlocks.findIndex(b => b.id === id); if(index > -1) currentBlocks[index].is_completed = isCompleted; }
    renderBlocks(); await supabaseClient.from('daily_blocks').update({ is_completed: isCompleted }).eq('id', id);
}

function handleEnter(e) { if(e.key === 'Enter') addNewTask(); }

async function addNewTask() {
    const input = document.getElementById('new-task-input');
    const categoryInput = document.getElementById('task-category');
    const timeInput = document.getElementById('new-task-time');
    
    const title = escapeHTML(input.value.trim()); 
    const timeVal = timeInput.value; 
    const selectedCategory = categoryInput.value;
    if(!title) return;
    
    let formattedTime = 'بدون وقت';
    if (timeVal) { const [hour, min] = timeVal.split(':'); const h = parseInt(hour); const ampm = h >= 12 ? 'م' : 'ص'; const h12 = h % 12 || 12; formattedTime = `${h12}:${min} ${ampm}`; }
    
    const today = getLocalDate();
    const newTask = { user_id: currentUser.id, title: title, category: selectedCategory, scheduled_date: today, is_completed: false, task_time: formattedTime, shift_count: 0, is_pinned: false };

    input.disabled = true; input.value = 'جاري...';
    const { data } = await supabaseClient.from('daily_blocks').insert([newTask]).select();
    if(data) currentBlocks.push(data[0]); 
    input.value = ''; timeInput.value = ''; input.disabled = false; input.focus(); renderBlocks();
}

function openShiftModal(id) {
    taskToShiftId = id; document.getElementById('shift-modal').style.display = 'flex';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    const minDate = `${y}-${m}-${d}`;
    
    document.getElementById('shift-date').min = minDate; document.getElementById('shift-date').value = minDate;
}

function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }

async function confirmShift() {
    const shiftDate = document.getElementById('shift-date').value;
    if(!shiftDate) {
        showNeoAlert('تنبيه', 'من فضلك اختار اليوم اللي هتأجل فيه المهمة.', 'danger');
        return;
    }
    
    const shiftedTask = currentBlocks.find(b => b.id === taskToShiftId);
    if(shiftedTask) { 
        shiftedTask.scheduled_date = shiftDate; 
        shiftedTask.shift_count = (shiftedTask.shift_count || 0) + 1; 
        futureBlocks.push(shiftedTask); 
    }
    currentBlocks = currentBlocks.filter(b => b.id !== taskToShiftId);
    
    closeModal('shift-modal'); futureBlocks.sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)); renderBlocks();
    
    await supabaseClient.from('daily_blocks').update({ 
        scheduled_date: shiftDate, 
        is_shifted: true, 
        shifted_to_date: shiftDate,
        shift_count: shiftedTask.shift_count 
    }).eq('id', taskToShiftId);
}

function logout() { 
    showNeoConfirm('تسجيل الخروج', 'هل أنت متأكد إنك عايز تخرج دلوقتي؟', async () => {
        await supabaseClient.auth.signOut(); 
        window.location.href = 'login.html'; 
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.querySelectorAll('.tab-section').forEach(section => section.style.display = 'none');
    document.getElementById(`${tabName}-section`).style.display = 'block';
    if (tabName === 'analytics') loadAnalytics();
}

async function loadAnalytics() {
    const { data: completedTasks } = await supabaseClient.from('daily_blocks').select('category').eq('user_id', currentUser.id).eq('is_completed', true);
    const counts = {};
    if (completedTasks) completedTasks.forEach(task => { counts[task.category] = (counts[task.category] || 0) + 1; });
    const labels = userCategories.map(c => c.name); const dataValues = userCategories.map(c => counts[c.name] || 0); const backgroundColors = userCategories.map(c => c.color);
    renderChart(labels, dataValues, backgroundColors);
}

function renderChart(labels, data, colors) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (myChart) myChart.destroy(); 
    myChart = new Chart(ctx, {
        type: 'doughnut', 
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 10 }] },
        options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: '#a1a1aa', padding: 25, font: { family: 'Alexandria', size: 13 } } } }, layout: { padding: 20 } }
    });
}

// === دوال محاكاة واجهة الدليل التفاعلية (Guide Interactivity) ===
function setDemoRating(stars) {
    const starSpans = document.getElementById('demo-rating-stars').children;
    for(let i=0; i<5; i++) {
        starSpans[i].classList.toggle('active', i < stars);
    }
}

function updateDemoProgress(percentage) {
    const circle = document.getElementById('demo-progress-circle');
    const text = document.getElementById('demo-progress-text');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
    text.innerText = percentage == 100 ? '✅' : `${percentage}%`;
}

function triggerDemoSplit() {
    const wrapper = document.getElementById('demo-split-wrapper');
    wrapper.style.opacity = '0';
    wrapper.style.transition = 'all 0.4s ease';
    
    setTimeout(() => {
        wrapper.innerHTML = `
            <p style="margin: 0 0 10px 0; color: #10b981; font-size: 13px; font-weight: 600;">✨ عاش! شفت؟ المهمة المعقدة اتكسرت لخطوتين بساط تقدر تبدأ فيهم فوراً وبدون تسويف:</p>
            <div class="task-list">
                <div class="task-card" style="border-right-color: #10b981;">
                    <div class="task-content-wrapper">
                        <label class="custom-checkbox"><input type="checkbox" onchange="this.parentElement.parentElement.parentElement.classList.toggle('completed')"><span class="checkmark"></span></label>
                        <div class="task-details">
                            <h3 class="task-title">كتابة العناوين الرئيسية للتقرير</h3>
                            <div class="task-meta"><span style="color: #10b981">💼 العمل</span><span>&bull;</span><span>10 دقايق بس</span></div>
                        </div>
                    </div>
                </div>
                <div class="task-card" style="border-right-color: #10b981;">
                    <div class="task-content-wrapper">
                        <label class="custom-checkbox"><input type="checkbox" onchange="this.parentElement.parentElement.parentElement.classList.toggle('completed')"><span class="checkmark"></span></label>
                        <div class="task-details">
                            <h3 class="task-title">كتابة أول صفحة كمقدمة</h3>
                            <div class="task-meta"><span style="color: #10b981">💼 العمل</span><span>&bull;</span><span>15 دقيقة</span></div>
                        </div>
                    </div>
                </div>
            </div>
            <button class="neo-btn secondary full-width mt-15" onclick="location.reload()" style="font-size: 12px; padding: 8px;">إعادة التجربة 🔄</button>
        `;
        wrapper.style.opacity = '1';
    }, 400);
}

initApp();
