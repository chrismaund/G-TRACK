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
};

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

    // Role / Credential mismatches
    if (code === 'auth/invalid-credential' || 
        code === 'auth/wrong-password' || 
        code === 'auth/user-not-found' || 
        code === 'auth/invalid-login-credentials' ||
        msg.includes('INVALID_LOGIN_CREDENTIALS') ||
        msg.includes('invalid-credential') ||
        msg.includes('wrong-password') ||
        msg.includes('user-not-found')) {
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

    // EMPLOYEE REGISTRATION WITH FIRESTORE WRITE
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fullName = document.getElementById('regFullName').value.trim();
            const email = document.getElementById('regEmail').value.trim().toLowerCase();
            const department = (document.getElementById('regDepartment')?.value || '').trim();
            const password = document.getElementById('regPassword').value;

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

            if (!password || password.length < 6) {
                if (regErrorMessage) {
                    regErrorMessage.textContent = 'Password must be at least 6 characters long.';
                    regErrorMessage.style.display = 'block';
                }
                return;
            }

            // Create Auth Account and write to Firestore
            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    
                    // Write document to 'users' collection using UID as Document ID
                    return db.collection("users").doc(user.uid).set({
                        uid: user.uid,
                        fullName: fullName,
                        email: email,
                        department: department,
                        role: "employee",
                        status: "pending",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                })
                .then(() => {
                    if (regSuccessMessage) {
                        regSuccessMessage.textContent = 'Registration successful! Awaiting Admin approval.';
                        regSuccessMessage.style.display = 'block';
                    }
                    registerForm.reset();
                    return auth.signOut(); // Keep signed out until approved
                })
                .catch((error) => {
                    if (regErrorMessage) {
                        regErrorMessage.textContent = formatAuthError(error);
                        regErrorMessage.style.display = 'block';
                    }
                });
        });
    }

    // LOGIN VERIFICATION WITH APPROVAL CHECK
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const role = document.getElementById('selectedRole') ? document.getElementById('selectedRole').value : 'admin';

            if (errorMessage) errorMessage.style.display = "none";

            auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    return db.collection("users").doc(user.uid).get();
                })
                .then((docSnap) => {
                    if (!docSnap.exists) {
                        throw new Error("Invalid account for this role (profile not found).");
                    }

                    const userData = docSnap.data();

                    if (role === 'admin') {
                        if (userData.role !== 'admin') {
                            auth.signOut();
                            throw new Error("Unauthorized access. Account is not an Admin.");
                        }
                        window.location.href = "../dashboard/admin.html";
                    } else {
                        if (userData.role !== 'employee') {
                            auth.signOut();
                            throw new Error("Invalid account for the Employee role.");
                        }
                        if (userData.status === 'pending') {
                            auth.signOut();
                            throw new Error("Your account is awaiting Admin authorization.");
                        }
                        if (userData.status === 'rejected') {
                            auth.signOut();
                            throw new Error("Your registration request was rejected by an administrator.");
                        }
                        window.location.href = "../dashboard/employee.html";
                    }
                })
                .catch((error) => {
                    if (errorMessage) {
                        errorMessage.textContent = formatAuthError(error);
                        errorMessage.style.display = "block";
                    }
                });
        });
    }
});