import { createClient } from '@supabase/supabase-js';
import { loadStripe } from '@stripe/stripe-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Auth state management
let currentUser = null;

async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;
    updateUIForAuthState(!!user);
}

// Update UI based on auth state
function updateUIForAuthState(isAuthenticated) {
    const loginBtn = document.getElementById('loginBtn');
    const ctaButtons = document.querySelectorAll('.cta-button, .subscribe-button');
    
    if (isAuthenticated) {
        loginBtn.textContent = 'Account';
        ctaButtons.forEach(btn => {
            btn.textContent = 'Subscribe Now';
        });
    } else {
        loginBtn.textContent = 'Login';
        ctaButtons.forEach(btn => {
            btn.textContent = 'Get Started';
        });
    }
}

// Auth modal handling
async function showAuthModal(isLogin = true) {
    const modal = document.createElement('div');
    modal.className = 'auth-modal';
    modal.innerHTML = `
        <div class="auth-modal-content">
            <h2>${isLogin ? 'Login' : 'Sign Up'}</h2>
            <form id="authForm">
                <input type="email" id="email" placeholder="Email" required>
                <input type="password" id="password" placeholder="Password" required>
                <button type="submit">${isLogin ? 'Login' : 'Sign Up'}</button>
            </form>
            <p class="auth-switch">
                ${isLogin ? "Don't have an account? " : "Already have an account? "}
                <a href="#" id="switchAuth">${isLogin ? 'Sign Up' : 'Login'}</a>
            </p>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle form submission
    const form = document.getElementById('authForm');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
            }
            modal.remove();
            checkUser();
        } catch (error) {
            alert(error.message);
        }
    };

    // Handle switching between login/signup
    document.getElementById('switchAuth').onclick = (e) => {
        e.preventDefault();
        modal.remove();
        showAuthModal(!isLogin);
    };

    // Close modal when clicking outside
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

// Handle subscription
async function handleSubscription(planType) {
    if (!currentUser) {
        showAuthModal(false);
        return;
    }

    try {
        const stripe = await stripePromise;
        
        // Create checkout session
        const response = await fetch('/.netlify/functions/create-checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                planType,
                userId: currentUser.id,
                email: currentUser.email
            }),
        });

        const session = await response.json();

        // Redirect to checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id,
        });

        if (result.error) {
            throw new Error(result.error.message);
        }
    } catch (error) {
        alert('Error creating checkout session: ' + error.message);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    checkUser();

    // Auth button listeners
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        if (currentUser) {
            supabase.auth.signOut();
            currentUser = null;
            updateUIForAuthState(false);
        } else {
            showAuthModal(true);
        }
    });

    // Subscribe button listeners
    document.querySelectorAll('.subscribe-button').forEach(button => {
        button.addEventListener('click', () => {
            const planType = button.dataset.plan;
            handleSubscription(planType);
        });
    });

    // CTA button listeners
    document.querySelectorAll('.cta-button').forEach(button => {
        button.addEventListener('click', () => {
            if (currentUser) {
                // Scroll to pricing section
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
            } else {
                showAuthModal(false);
            }
        });
    });
});

// Auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateUIForAuthState(!!currentUser);
});