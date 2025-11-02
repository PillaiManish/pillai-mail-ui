document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const mainContainer = document.getElementById('main-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const emailList = document.getElementById('email-list');
    const emailViewContainer = document.getElementById('email-view-container');
    const logoutButton = document.getElementById('logout-button');

    const API_URL = 'http://pillaimanish.cloud:8081/api/auth';

    let conversations = [];

    // Check for a stored token on page load
    const token = localStorage.getItem('jwt');
    if (token) {
        showMainView();
        fetchConversations();
    }

    // --- Event Listeners ---

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                throw new Error('Login failed. Please check your credentials.');
            }

            const data = await response.json();
            localStorage.setItem('jwt', data.token);
            showMainView();
            fetchConversations();
        } catch (error) {
            loginError.textContent = error.message;
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwt');
        showLoginView();
    });

    // --- UI Functions ---

    function showLoginView() {
        loginContainer.style.display = 'block';
        mainContainer.style.display = 'none';
        emailList.innerHTML = '';
        emailViewContainer.innerHTML = '';
        loginError.textContent = '';
    }

    function showMainView() {
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
    }

    // --- API Functions ---

    async function fetchConversations() {
        try {
            const token = localStorage.getItem('jwt');
            const response = await fetch(`${API_URL}/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch conversations.');
            }

            conversations = await response.json();
            displayConversations(conversations);
        } catch (error) {
            console.error(error);
            if (String(error).includes('401')) {
                showLoginView();
            }
        }
    }

    function displayConversations(conversations) {
        emailList.innerHTML = ''; // Clear previous list
        if (!conversations || conversations.length === 0) {
            emailList.innerHTML = '<li>No conversations found.</li>';
            return;
        }

        conversations.forEach(convo => {
            const li = document.createElement('li');
            li.dataset.id = convo.ID;

            const subject = document.createElement('div');
            subject.className = 'email-subject';
            subject.textContent = convo.subject || '(No Subject)';

            const participants = document.createElement('div');
            participants.className = 'email-participants';
            participants.textContent = convo.emails[0]?.from || 'Unknown Sender';

            li.appendChild(subject);
            li.appendChild(participants);

            li.addEventListener('click', () => displayConversation(convo.ID));
            emailList.appendChild(li);
        });
    }

    function displayConversation(convoId) {
        const conversation = conversations.find(c => c.ID === convoId);
        if (!conversation) return;

        emailViewContainer.innerHTML = ''; // Clear previous view

        conversation.emails.forEach(email => {
            const emailContainer = document.createElement('div');
            emailContainer.className = 'email-in-thread';

            const header = document.createElement('div');
            header.className = 'email-thread-header';
            header.innerHTML = `<b>From:</b> ${email.from}<br><b>To:</b> ${email.to}<br><b>Subject:</b> ${email.subject}`;

            const body = document.createElement('div');
            body.className = 'email-thread-body';
            body.style.display = 'none';
            body.innerHTML = '<p><i>Click to load content...</i></p>';

            header.addEventListener('click', () => {
                if (body.style.display === 'none') {
                    body.style.display = 'block';
                    // Only fetch if content hasn't been loaded
                    if (!body.dataset.loaded) {
                        body.innerHTML = '<p><i>Loading...</i></p>';
                        fetchEmailContent(email.ID, body);
                        body.dataset.loaded = 'true';
                    }
                } else {
                    body.style.display = 'none';
                }
            });

            emailContainer.appendChild(header);
            emailContainer.appendChild(body);
            emailViewContainer.appendChild(emailContainer);
        });
    }

    async function fetchEmailContent(emailId, targetElement) {
        try {
            const token = localStorage.getItem('jwt');
            const response = await fetch(`${API_URL}/emails/${emailId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch email content.');
            }

            const emailBody = await response.json();
            renderEmail(emailBody, targetElement);
        } catch (error) {
            console.error('Error fetching or rendering email:', error);
            targetElement.innerHTML = '<p>Could not load email content.</p>';
        }
    }

    function renderEmail(emailBody, targetElement) {
        targetElement.innerHTML = ''; // Clear previous content

        if (emailBody.html_body) {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('sandbox', 'allow-same-origin');
            iframe.srcdoc = emailBody.html_body;
            iframe.style.width = '100%';
            iframe.style.height = '400px'; // Give a fixed height for now
            iframe.style.border = 'none';
            targetElement.appendChild(iframe);
        } else if (emailBody.text_body) {
            const pre = document.createElement('pre');
            pre.textContent = emailBody.text_body;
            targetElement.appendChild(pre);
        } else {
            targetElement.innerHTML = '<pre>Could not display email content.</pre>';
        }
    }
});
