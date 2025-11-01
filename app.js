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
            // *** FIX: Corrected the endpoint from /conversations to /emails ***
            const response = await fetch(`${API_URL}/emails`, {
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
            // A real implementation would be more robust
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

            emailContainer.appendChild(header);
            emailContainer.appendChild(body);
            emailViewContainer.appendChild(emailContainer);

            // Fetch and render the body for each email
            fetchEmailContent(email.ID, body);
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

            const rawEmail = await response.text();
            renderEmail(rawEmail, targetElement);
        } catch (error) {
            console.error('Error fetching or rendering email:', error);
            targetElement.innerHTML = '<p>Could not load email content.</p>';
        }
    }

    function renderEmail(rawEmail, targetElement) {
        targetElement.innerHTML = ''; // Clear previous content

        function escapeRegex(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function decodeQuotedPrintable(input) {
            if (!input) return '';
            return input
                .replace(/=\r?\n/g, '') // Remove soft line breaks
                .replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
        }

        function getPartBody(part) {
            const encodingMatch = part.match(/Content-Transfer-Encoding: (.*)/i);
            const encoding = encodingMatch ? encodingMatch[1].trim().toLowerCase() : '';
            const bodyStartIndex = part.indexOf('\r\n\r\n');
            if (bodyStartIndex === -1) return '';
            let body = part.substring(bodyStartIndex + 4);
            if (encoding === 'quoted-printable') {
                return decodeQuotedPrintable(body);
            }
            return body;
        }

        const boundaryMatch = rawEmail.match(/boundary="?([^\s"]+)"?/i);
        let htmlBody = '';
        let textBody = '';

        if (boundaryMatch) {
            const boundary = boundaryMatch[1];
            const escapedBoundary = escapeRegex(boundary);
            const parts = rawEmail.split(new RegExp(`--${escapedBoundary}(--)?`));
            
            const htmlPart = parts.find(p => p && p.includes('Content-Type: text/html'));
            const textPart = parts.find(p => p && p.includes('Content-Type: text/plain'));

            if (htmlPart) htmlBody = getPartBody(htmlPart);
            if (textPart) textBody = getPartBody(textPart);
        } else {
            textBody = getPartBody(rawEmail);
        }

        if (htmlBody) {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('sandbox', 'allow-same-origin');
            iframe.srcdoc = htmlBody;
            iframe.style.width = '100%';
            iframe.style.height = '400px'; // Give a fixed height for now
            iframe.style.border = 'none';
            targetElement.appendChild(iframe);
        } else if (textBody) {
            const lines = textBody.replace(/\r/g, '').split('\n');
            const mainMessage = [];
            const quotedBlock = [];
            let inQuotedBlock = false;
            const quoteHeaderRegex = /On .* wrote:/;

            for (const line of lines) {
                if (quoteHeaderRegex.test(line) || line.startsWith('>')) {
                    inQuotedBlock = true;
                }
                if (inQuotedBlock) {
                    quotedBlock.push(line);
                } else {
                    mainMessage.push(line);
                }
            }

            const mainPre = document.createElement('pre');
            mainPre.textContent = mainMessage.join('\n').trim();
            targetElement.appendChild(mainPre);

            if (quotedBlock.length > 0) {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                summary.textContent = '...';
                summary.className = 'quoted-summary';
                const quotedPre = document.createElement('pre');
                quotedPre.className = 'quoted-text';
                quotedPre.textContent = quotedBlock.join('\n');
                details.appendChild(summary);
                details.appendChild(quotedPre);
                targetElement.appendChild(details);
            }
        } else {
            targetElement.innerHTML = '<pre>Could not display email content.</pre>';
        }
    }
});
