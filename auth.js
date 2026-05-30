const SUPABASE_URL = 'https://tnqlqsjyncfcanlzewao.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWxxc2p5bmNmY2FubHpld2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzYxNTUsImV4cCI6MjA5NTcxMjE1NX0.e9xfEINP-Jnf1NTV7lvayeIk4ZVxLSanYjuAwzt41ZY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { window.location.href = 'index.html'; }
}
checkUserSession();

// دالة لتغيير حالة الزرار أثناء التحميل
function setLoading(isLoading, btnId) {
    const btn = document.getElementById(btnId);
    if(isLoading) {
        btn.disabled = true;
        btn.dataset.originalText = btn.innerText;
        btn.innerText = 'جاري المعالجة... ⏳';
        btn.style.opacity = '0.7';
    } else {
        btn.disabled = false;
        btn.innerText = btn.dataset.originalText || (btnId === 'login-btn' ? 'تسجيل الدخول' : 'إنشاء حساب جديد');
        btn.style.opacity = '1';
    }
}

async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-msg');
    
    if (!email || password.length < 6) {
        errorDiv.innerText = "أدخل إيميل صحيح وكلمة مرور (6 أحرف على الأقل).";
        return;
    }

    setLoading(true, 'signup-btn');
    errorDiv.innerText = '';

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    
    if (error) {
        errorDiv.style.color = 'var(--danger)';
        errorDiv.innerText = error.message;
        setLoading(false, 'signup-btn');
    } else {
        errorDiv.style.color = 'var(--accent)';
        errorDiv.innerText = "✨ تم إنشاء الحساب بنجاح! جاري الدخول...";
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-msg');

    if (!email || !password) {
        errorDiv.innerText = "يرجى ملء جميع الحقول.";
        return;
    }

    setLoading(true, 'login-btn');
    errorDiv.innerText = '';

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        errorDiv.style.color = 'var(--danger)';
        errorDiv.innerText = "❌ البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        setLoading(false, 'login-btn');
    } else {
        window.location.href = 'index.html';
    }
}