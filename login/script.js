// Replace with your actual Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyAfNAuQSyCS6fslTarSJUBZ_6w2Z7iRKjw",
    authDomain: "gso-gtrack.firebaseapp.com",
    databaseURL: "https://gso-gtrack-default-rtdb.firebaseio.com",
    projectId: "gso-gtrack",
    storageBucket: "gso-gtrack.firebasestorage.app",
    messagingSenderId: "599744539051",
    appId: "1:599744539051:web:ad84868be0c69328a60aee",
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// =========================================================================
// CUSTOM DEPARTMENT DROPDOWN CONTROLS
// =========================================================================
window.toggleDeptDropdown = function(e) {
    if (e) e.stopPropagation();
    const wrapper = document.getElementById('deptSelectWrapper');
    const searchInput = document.getElementById('deptSearchInput');
    if (wrapper) {
        const willOpen = !wrapper.classList.contains('open');
        
        if (willOpen) {
            const trigger = wrapper.querySelector('.custom-select-trigger') || wrapper;
            const rect = trigger.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const estimatedMenuHeight = 250;

            if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
                wrapper.classList.add('drop-up');
            } else {
                wrapper.classList.remove('drop-up');
            }

            wrapper.classList.add('open');
            if (searchInput) {
                searchInput.value = '';
                window.filterDeptOptions('');
                setTimeout(() => searchInput.focus(), 50);
            }
        } else {
            wrapper.classList.remove('open');
            wrapper.classList.remove('drop-up');
        }
    }
};

window.filterDeptOptions = function(query) {
    const q = (query || '').toLowerCase().trim();
    const options = document.querySelectorAll('.dept-options-list .custom-option');
    options.forEach(opt => {
        const text = (opt.textContent || '').toLowerCase();
        if (!q || text.includes(q)) {
            opt.style.display = 'flex';
        } else {
            opt.style.display = 'none';
        }
    });
};

window.selectDeptOption = function(value, label) {
    const hiddenInput = document.getElementById('regDepartment');
    const textSpan = document.getElementById('deptSelectText');
    const trigger = document.getElementById('deptSelectTrigger');
    const wrapper = document.getElementById('deptSelectWrapper');

    if (hiddenInput) hiddenInput.value = value;
    if (textSpan) textSpan.textContent = label;
    if (trigger) trigger.classList.add('selected');

    // Update selected class on options
    const options = document.querySelectorAll('.custom-option');
    options.forEach(opt => {
        if (opt.getAttribute('data-value') === value) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });

    if (wrapper) {
        wrapper.classList.remove('open');
        wrapper.classList.remove('drop-up');
    }
};

// Dismiss custom dropdown on click outside
document.addEventListener('click', function(e) {
    const wrapper = document.getElementById('deptSelectWrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        wrapper.classList.remove('open');
    }
});

window.switchRole = function(role) {
    const tabAdmin = document.getElementById('tabAdmin');
    const tabEmployee = document.getElementById('tabEmployee');
    const selectedRoleInput = document.getElementById('selectedRole');
    const registerLinkWrapper = document.getElementById('registerLinkWrapper');
    const formSubtitle = document.getElementById('formSubtitle');

    if (tabAdmin && tabEmployee) {
        tabAdmin.classList.toggle('active', role === 'admin');
        tabEmployee.classList.toggle('active', role === 'employee');
    }
    
    if (selectedRoleInput) selectedRoleInput.value = role;

    window.showLoginForm();

    if (role === 'employee') {
        if (registerLinkWrapper) registerLinkWrapper.style.display = 'block';
        if (formSubtitle) formSubtitle.textContent = 'Employee Authentication Portal';
    } else {
        if (registerLinkWrapper) registerLinkWrapper.style.display = 'none';
        if (formSubtitle) formSubtitle.textContent = 'Administrator Control Access';
    }
};

window.togglePass = function(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
    input.setAttribute('type', type);
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
};

window.showRegisterForm = function(e) {
    if (e) e.preventDefault();
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const formSubtitle = document.getElementById('formSubtitle');

    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
    if (formSubtitle) formSubtitle.textContent = 'Register New Employee Account';
    if (typeof window.evaluateRegPasswordRequirements === 'function') {
        window.evaluateRegPasswordRequirements('');
    }
};

window.showLoginForm = function(e) {
    if (e) e.preventDefault();
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const selectedRoleInput = document.getElementById('selectedRole');
    const formSubtitle = document.getElementById('formSubtitle');

    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';

    if (formSubtitle && selectedRoleInput) {
        formSubtitle.textContent = selectedRoleInput.value === 'employee' 
            ? 'Employee Authentication Portal' 
            : 'Administrator Control Access';
    }
    if (typeof window.evaluateRegPasswordRequirements === 'function') {
        window.evaluateRegPasswordRequirements('');
    }
};

window.openForgotPasswordModal = function(e) {
    if (e) e.preventDefault();
    const modal = document.getElementById('forgot-password-modal');
    const resetEmailInput = document.getElementById('resetEmail');
    const loginEmailInput = document.getElementById('email');
    const errorMsg = document.getElementById('reset-error-msg');
    const successMsg = document.getElementById('reset-success-msg');

    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';

    if (loginEmailInput && loginEmailInput.value.trim() && resetEmailInput) {
        resetEmailInput.value = loginEmailInput.value.trim();
    }

    if (modal) {
        modal.style.display = 'flex';
        modal.offsetHeight; // trigger reflow for smooth CSS animation
        modal.classList.add('open');
        if (resetEmailInput) {
            setTimeout(() => resetEmailInput.focus(), 80);
        }
    }
};

window.closeForgotPasswordModal = function() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 200);
    }
};

window.handleSendPasswordReset = async function(e) {
    if (e) e.preventDefault();
    const resetEmailInput = document.getElementById('resetEmail');
    const errorMsg = document.getElementById('reset-error-msg');
    const successMsg = document.getElementById('reset-success-msg');
    const sendBtn = document.getElementById('sendResetBtn');

    if (!resetEmailInput) return;
    const email = resetEmailInput.value.trim().toLowerCase();

    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';

    const emailRegex = /^[^\s@]+@[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (errorMsg) {
            errorMsg.textContent = 'Please enter a valid email address.';
            errorMsg.style.display = 'block';
        }
        return;
    }

    const originalHTML = sendBtn ? sendBtn.innerHTML : '<span>Send Reset Link</span> <i class="fas fa-paper-plane"></i>';
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Sending link...</span>';
    }

    try {
        await auth.sendPasswordResetEmail(email);
        if (successMsg) {
            successMsg.textContent = `Password reset email sent to ${email}. Please check your inbox or spam folder.`;
            successMsg.style.display = 'block';
        }
        resetEmailInput.value = '';
    } catch (err) {
        if (errorMsg) {
            errorMsg.textContent = formatAuthError(err);
            errorMsg.style.display = 'block';
        }
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalHTML;
        }
    }
};

// Real-time Registration Password Requirements Evaluator
window.evaluateRegPasswordRequirements = function(password) {
    const p = password || '';
    const isLen = p.length >= 8;
    const isUpper = /[A-Z]/.test(p);
    const isLower = /[a-z]/.test(p);
    const isNum = /[0-9]/.test(p);
    const isSpecial = /[^A-Za-z0-9]/.test(p);

    const elLen = document.getElementById('reg-req-length');
    const elUpper = document.getElementById('reg-req-upper');
    const elLower = document.getElementById('reg-req-lower');
    const elNum = document.getElementById('reg-req-number');
    const elSpecial = document.getElementById('reg-req-special');

    if (elLen) elLen.classList.toggle('valid', isLen);
    if (elUpper) elUpper.classList.toggle('valid', isUpper);
    if (elLower) elLower.classList.toggle('valid', isLower);
    if (elNum) elNum.classList.toggle('valid', isNum);
    if (elSpecial) elSpecial.classList.toggle('valid', isSpecial);

    return isLen && isUpper && isLower && isNum && isSpecial;
};

// Dismiss Forgot Password modal on backdrop click or Escape key
document.addEventListener('click', function(e) {
    const modal = document.getElementById('forgot-password-modal');
    if (modal && e.target === modal) {
        window.closeForgotPasswordModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        window.closeForgotPasswordModal();
    }
});

function formatAuthError(error) {
    if (!error) return "An unknown error occurred. Please try again.";
    
    const msg = error.message || String(error);
    const code = error.code || "";

    // Check for custom thrown validation messages
    if (msg.includes("Unauthorized access") || 
        msg.includes("Invalid account role") ||
        msg.includes("Invalid role selected") ||
        msg.includes("awaiting Admin authorization") ||
        msg.includes("rejected by an administrator") ||
        msg.includes("User profile record not found") ||
        msg.includes("Employee email must contain")) {
        return msg;
    }

    if (code === 'auth/user-not-found' || msg.includes('user-not-found')) {
        return "No registered account found with this email address.";
    }

    // Role / Credential mismatches
    if (code === 'auth/invalid-credential' || 
        code === 'auth/wrong-password' || 
        code === 'auth/invalid-login-credentials' ||
        msg.includes('INVALID_LOGIN_CREDENTIALS') ||
        msg.includes('invalid-credential') ||
        msg.includes('wrong-password')) {
        return "Invalid email or password for this role.";
    }

    if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
        return "Please enter a valid email address.";
    }

    if (code === 'auth/user-disabled' || msg.includes('user-disabled')) {
        return "This account has been disabled. Please contact the administrator.";
    }

    if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        return "Too many failed attempts. Please try again in a few minutes.";
    }

    if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
        return "An account with this email address is already registered.";
    }

    if (code === 'auth/weak-password' || msg.includes('weak-password')) {
        return "Password should be at least 6 characters.";
    }

    // Fallback: If message starts with raw JSON from REST API, format cleanly
    if (msg.startsWith('{') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
        return "Invalid account credentials for the selected role.";
    }

    return msg.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/[^)]+\)\.?/, '');
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('error-message');
    const regErrorMessage = document.getElementById('reg-error-message');
    const regSuccessMessage = document.getElementById('reg-success-message');

    // =========================================================================
    // REMEMBER ME AUTO-FILL & PREFERENCES
    // =========================================================================
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const emailInput = document.getElementById('email');
    const savedRememberMe = localStorage.getItem('gtrack_remember_me');
    const savedEmail = localStorage.getItem('gtrack_remember_email');
    const savedRole = localStorage.getItem('gtrack_remember_role');

    if (rememberMeCheckbox) {
        rememberMeCheckbox.checked = (savedRememberMe !== 'false');
    }

    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
    }

    if (savedRole && typeof window.switchRole === 'function') {
        window.switchRole(savedRole);
    }

    // =========================================================================
    // SEAMLESS AUTO-LOGIN & LIVE SESSION VERIFICATION
    // =========================================================================
    let isAutoLoggingIn = false;
    auth.onAuthStateChanged(async (user) => {
        // Automatically transition user to their dashboard if an active session is preserved
        if (user && !isAutoLoggingIn) {
            const savedRememberPref = localStorage.getItem('gtrack_remember_me');
            if (savedRememberPref !== 'false') {
                isAutoLoggingIn = true;
                const submitBtn = document.getElementById('signInBtn') || (loginForm ? loginForm.querySelector('button[type="submit"]') : null);
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Verifying session...</span>';
                }

                try {
                    const docSnap = await db.collection("users").doc(user.uid).get();
                    if (!docSnap.exists) {
                        isAutoLoggingIn = false;
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
                        }
                        return;
                    }

                    const userData = docSnap.data();
                    if (userData.role === 'admin') {
                        sessionStorage.setItem('gtrack_user_dept', userData.department || 'Admin');
                        sessionStorage.setItem('gtrack_user_name', userData.fullName || userData.name || 'Administrator');
                        sessionStorage.setItem('gtrack_user_role', 'admin');
                        window.location.replace("../dashboard/admin.html");
                        return;
                    } else if (userData.role === 'employee') {
                        if (userData.status === 'pending' || userData.status === 'rejected') {
                            await auth.signOut();
                            isAutoLoggingIn = false;
                            if (submitBtn) {
                                submitBtn.disabled = false;
                                submitBtn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
                            }
                            return;
                        }
                        sessionStorage.setItem('gtrack_user_dept', userData.department || '');
                        sessionStorage.setItem('gtrack_user_name', userData.fullName || userData.name || '');
                        sessionStorage.setItem('gtrack_user_role', 'employee');
                        window.location.replace("../dashboard/employee.html");
                        return;
                    }
                } catch (err) {
                    console.warn("Auto-session verification notice:", err);
                    isAutoLoggingIn = false;
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
                    }
                }
            }
        }
    });

    // EMPLOYEE REGISTRATION WITH FIRESTORE WRITE
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fullName = document.getElementById('regFullName').value.trim();
            const email = document.getElementById('regEmail').value.trim().toLowerCase();
            const department = (document.getElementById('regDepartment')?.value || '').trim();
            const password = document.getElementById('regPassword').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            if (regErrorMessage) regErrorMessage.style.display = 'none';
            if (regSuccessMessage) regSuccessMessage.style.display = 'none';

            if (!fullName || fullName.length < 2) {
                if (regErrorMessage) {
                    regErrorMessage.textContent = 'Please enter your full legal name.';
                    regErrorMessage.style.display = 'block';
                }
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                if (regErrorMessage) {
                    regErrorMessage.textContent = 'Please enter a valid email address.';
                    regErrorMessage.style.display = 'block';
                }
                return;
            }

            if (!department) {
                if (regErrorMessage) {
                    regErrorMessage.textContent = 'Please select your municipal department / office.';
                    regErrorMessage.style.display = 'block';
                }
                return;
            }

            const isLen = password.length >= 8;
            const isUpper = /[A-Z]/.test(password);
            const isLower = /[a-z]/.test(password);
            const isNum = /[0-9]/.test(password);
            const isSpecial = /[^A-Za-z0-9]/.test(password);

            if (!isLen || !isUpper || !isLower || !isNum || !isSpecial) {
                if (regErrorMessage) {
                    regErrorMessage.textContent = 'Password does not meet all security requirements (8+ characters, uppercase, lowercase, number, and special symbol).';
                    regErrorMessage.style.display = 'block';
                }
                const regPassInput = document.getElementById('regPassword');
                if (regPassInput) regPassInput.focus();
                return;
            }

            const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '<span>Submit Request</span> <i class="fas fa-paper-plane"></i>';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Processing...</span>';
            }

            // Create Auth Account and write to Firestore (with deleted-account reclamation)
            try {
                let userCredential = null;

                try {
                    userCredential = await auth.createUserWithEmailAndPassword(email, password);
                } catch (createErr) {
                    const isEmailInUse = createErr.code === 'auth/email-already-in-use' || 
                        (createErr.message && createErr.message.includes('email-already-in-use'));

                    if (!isEmailInUse) {
                        throw createErr;
                    }

                    // Check if an active user profile exists in Firestore
                    const existingUserSnap = await db.collection("users").where("email", "==", email).get();

                    if (!existingUserSnap.empty) {
                        // User genuinely exists in Firestore as an active account
                        throw createErr;
                    }

                    // No profile exists in Firestore (the account was deleted by Admin from dashboard)
                    // Attempt to sign in to the orphaned Auth record with the password entered
                    try {
                        const reAuthCred = await auth.signInWithEmailAndPassword(email, password);
                        // If authenticated, permanently delete the old Auth record to free up the email cleanly
                        await reAuthCred.user.delete();
                        // Re-create the account fresh with clean credentials
                        userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    } catch (reAuthErr) {
                        if (reAuthErr.code === 'auth/wrong-password') {
                            throw new Error("PREV_DELETED_WRONG_PASSWORD");
                        } else {
                            throw reAuthErr;
                        }
                    }
                }

                const user = userCredential.user;
                
                // Write document to 'users' collection using UID as Document ID
                await db.collection("users").doc(user.uid).set({
                    uid: user.uid,
                    fullName: fullName,
                    email: email,
                    department: department,
                    role: "employee",
                    status: "pending",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (regSuccessMessage) {
                    regSuccessMessage.textContent = 'Registration successful! Awaiting Admin approval.';
                    regSuccessMessage.style.display = 'block';
                }
                registerForm.reset();
                if (typeof window.evaluateRegPasswordRequirements === 'function') {
                    window.evaluateRegPasswordRequirements('');
                }
                const textSpan = document.getElementById('deptSelectText');
                const trigger = document.getElementById('deptSelectTrigger');
                const hiddenInput = document.getElementById('regDepartment');
                if (textSpan) textSpan.textContent = 'Select Municipal Department';
                if (trigger) trigger.classList.remove('selected');
                if (hiddenInput) hiddenInput.value = '';
                document.querySelectorAll('#deptOptionsList .custom-option').forEach(o => o.classList.remove('selected'));

                await auth.signOut(); // Keep signed out until approved
            } catch (error) {
                if (regErrorMessage) {
                    if (error.message === "PREV_DELETED_WRONG_PASSWORD") {
                        regErrorMessage.innerHTML = `This email was previously used with a different password. Enter the previous password to re-register, or <a href="javascript:void(0)" id="reRegResetLink" style="color: #38bdf8; text-decoration: underline; font-weight: 700;">send a password reset link</a> to ${email}.`;
                        regErrorMessage.style.display = 'block';
                        const resetLink = document.getElementById('reRegResetLink');
                        if (resetLink) {
                            resetLink.onclick = async () => {
                                try {
                                    await auth.sendPasswordResetEmail(email);
                                    if (regSuccessMessage) {
                                        regSuccessMessage.textContent = `Password reset link sent to ${email}. Check your inbox, reset the password, and then complete registration.`;
                                        regSuccessMessage.style.display = 'block';
                                    }
                                    regErrorMessage.style.display = 'none';
                                } catch (resetErr) {
                                    regErrorMessage.textContent = formatAuthError(resetErr);
                                }
                            };
                        }
                    } else {
                        regErrorMessage.textContent = formatAuthError(error);
                        regErrorMessage.style.display = 'block';
                    }
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHTML;
                }
            }
        });
    }

    // LOGIN VERIFICATION WITH REMEMBER ME PERSISTENCE & APPROVAL CHECK
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const role = document.getElementById('selectedRole') ? document.getElementById('selectedRole').value : 'admin';
            const rememberMeCheckbox = document.getElementById('rememberMe');
            const isRememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : true;
            const submitBtn = document.getElementById('signInBtn') || loginForm.querySelector('button[type="submit"]');

            if (errorMessage) errorMessage.style.display = "none";

            const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '<span>Sign In</span> <i class="fas fa-arrow-right"></i>';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Authenticating...</span>';
            }

            try {
                // Set persistence mode according to Remember Me selection
                const persistenceMode = isRememberMe 
                    ? firebase.auth.Auth.Persistence.LOCAL 
                    : firebase.auth.Auth.Persistence.SESSION;
                
                await auth.setPersistence(persistenceMode);

                // Save or clear Remember Me preferences
                if (isRememberMe) {
                    localStorage.setItem('gtrack_remember_me', 'true');
                    localStorage.setItem('gtrack_remember_email', email);
                    localStorage.setItem('gtrack_remember_role', role);
                } else {
                    localStorage.setItem('gtrack_remember_me', 'false');
                    localStorage.removeItem('gtrack_remember_email');
                    localStorage.removeItem('gtrack_remember_role');
                }

                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                const docSnap = await db.collection("users").doc(user.uid).get();

                if (!docSnap.exists) {
                    try {
                        await user.delete();
                    } catch (delErr) {
                        console.warn("Could not auto-purge deleted auth user:", delErr);
                    }
                    throw new Error("This account was deleted by an administrator and has been permanently purged from the system.");
                }

                const userData = docSnap.data();

                if (role === 'admin') {
                    if (userData.role !== 'admin') {
                        await auth.signOut();
                        throw new Error("Unauthorized access. Account is not an Admin.");
                    }
                    sessionStorage.setItem('gtrack_user_dept', userData.department || 'Admin');
                    sessionStorage.setItem('gtrack_user_name', userData.fullName || userData.name || 'Administrator');
                    sessionStorage.setItem('gtrack_user_role', 'admin');
                    window.location.replace("../dashboard/admin.html");
                } else {
                    if (userData.role !== 'employee') {
                        await auth.signOut();
                        throw new Error("Invalid account for the Employee role.");
                    }
                    if (userData.status === 'pending') {
                        await auth.signOut();
                        throw new Error("Your account is awaiting Admin authorization.");
                    }
                    if (userData.status === 'rejected') {
                        await auth.signOut();
                        throw new Error("Your registration request was rejected by an administrator.");
                    }
                    sessionStorage.setItem('gtrack_user_dept', userData.department || '');
                    sessionStorage.setItem('gtrack_user_name', userData.fullName || userData.name || '');
                    sessionStorage.setItem('gtrack_user_role', 'employee');
                    window.location.replace("../dashboard/employee.html");
                }
            } catch (error) {
                if (errorMessage) {
                    errorMessage.textContent = formatAuthError(error);
                    errorMessage.style.display = "block";
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHTML;
                }
            }
        });
    }

    // =========================================================================
    // GOOGLE AUTHENTICATION SYSTEM
    // =========================================================================
    let pendingGoogleUser = null;

    window.handleGoogleSignIn = async function() {
        const googleBtn = document.getElementById('googleSignInBtn');
        const errorMessage = document.getElementById('error-message');
        const selectedRole = document.getElementById('selectedRole') ? document.getElementById('selectedRole').value : 'admin';

        if (errorMessage) {
            errorMessage.style.display = "none";
            errorMessage.style.color = "";
            errorMessage.style.borderColor = "";
        }

        const originalBtnHTML = googleBtn ? googleBtn.innerHTML : '';
        if (googleBtn) {
            googleBtn.disabled = true;
            googleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Connecting to Google...</span>';
        }

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ prompt: 'select_account' });
            
            const result = await auth.signInWithPopup(provider);
            const user = result.user;
            if (!user) return;

            // Fetch user profile from Firestore by UID
            let docSnap = await db.collection("users").doc(user.uid).get();
            let userData = null;

            if (docSnap.exists) {
                userData = docSnap.data();
            } else {
                // Check if there is an existing profile registered with this email
                const userEmail = (user.email || '').toLowerCase().trim();
                if (userEmail) {
                    const emailSnap = await db.collection("users").where("email", "==", userEmail).get();
                    if (!emailSnap.empty) {
                        const matchedDoc = emailSnap.docs[0];
                        userData = matchedDoc.data();
                        // Mirror profile to user.uid so future lookups are instantaneous
                        if (matchedDoc.id !== user.uid) {
                            await db.collection("users").doc(user.uid).set({
                                ...userData,
                                uid: user.uid
                            }, { merge: true });
                        }
                    }
                }
            }

            // Case A: User profile does NOT exist yet (Brand new Google user)
            if (!userData) {
                pendingGoogleUser = user;
                openGoogleDeptModal();
                return;
            }

            // Case B: Existing User Profile Found - Route based on role & status
            if (userData.role === 'admin') {
                if (selectedRole === 'employee') {
                    // Gracefully switch to Admin tab if account is an Administrator
                    if (typeof window.switchRole === 'function') {
                        window.switchRole('admin');
                    }
                }
                sessionStorage.setItem('gtrack_user_dept', userData.department || 'Admin');
                sessionStorage.setItem('gtrack_user_name', userData.fullName || userData.name || user.displayName || 'Administrator');
                sessionStorage.setItem('gtrack_user_role', 'admin');
                window.location.replace("../dashboard/admin.html");
                return;
            } else {
                // Account is an Employee
                if (selectedRole === 'admin') {
                    await auth.signOut();
                    throw new Error("Unauthorized access. This account does not have Administrator privileges.");
                }
                if (userData.status === 'pending') {
                    await auth.signOut();
                    throw new Error("Your account is awaiting Admin authorization.");
                }
                if (userData.status === 'rejected') {
                    await auth.signOut();
                    throw new Error("Your registration request was rejected by an administrator.");
                }

                sessionStorage.setItem('gtrack_user_dept', userData.department || '');
                sessionStorage.setItem('gtrack_user_name', userData.fullName || userData.name || user.displayName || '');
                sessionStorage.setItem('gtrack_user_role', 'employee');
                window.location.replace("../dashboard/employee.html");
                return;
            }

        } catch (error) {
            // Silently ignore popup closed by user
            if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                return;
            }
            if (errorMessage) {
                errorMessage.textContent = formatAuthError(error);
                errorMessage.style.display = "block";
            }
        } finally {
            if (googleBtn) {
                googleBtn.disabled = false;
                googleBtn.innerHTML = originalBtnHTML;
            }
        }
    };

    window.openGoogleDeptModal = function() {
        const modal = document.getElementById('google-dept-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.cancelGoogleDeptSelection = async function() {
        const modal = document.getElementById('google-dept-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        pendingGoogleUser = null;
        await auth.signOut();
    };

    // Handle New Google User Department Submission
    const googleDeptForm = document.getElementById('googleDeptForm');
    if (googleDeptForm) {
        googleDeptForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!pendingGoogleUser) return;

            const deptSelect = document.getElementById('googleUserDept');
            const selectedDept = deptSelect ? deptSelect.value : '';
            const submitBtn = document.getElementById('googleDeptSubmitBtn');
            const errorMessage = document.getElementById('error-message');

            if (!selectedDept) {
                alert('Please select your municipal department.');
                return;
            }

            const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Saving...</span>';
            }

            try {
                // Write document to 'users' collection
                await db.collection("users").doc(pendingGoogleUser.uid).set({
                    uid: pendingGoogleUser.uid,
                    fullName: pendingGoogleUser.displayName || 'Employee',
                    email: (pendingGoogleUser.email || '').toLowerCase().trim(),
                    department: selectedDept,
                    role: "employee",
                    status: "pending",
                    photoURL: pendingGoogleUser.photoURL || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const modal = document.getElementById('google-dept-modal');
                if (modal) modal.style.display = 'none';

                await auth.signOut(); // Kept signed out until approved by admin

                if (errorMessage) {
                    errorMessage.innerHTML = `<i class="fas fa-check-circle" style="color: #4ade80; margin-right: 4px;"></i> Registration successful! Your account is awaiting Administrator approval.`;
                    errorMessage.style.display = "block";
                    errorMessage.style.borderColor = "rgba(74, 222, 128, 0.4)";
                    errorMessage.style.color = "#4ade80";
                }

                pendingGoogleUser = null;
            } catch (err) {
                console.error("Error saving Google user department:", err);
                alert("Could not complete registration: " + (err.message || err));
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnHTML;
                }
            }
        });
    }
});