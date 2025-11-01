document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const mainContainer = document.getElementById('main-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const emailList = document.getElementById('email-list');
    const emailContent = document.getElementById('email-content');
    const logoutButton = document.getElementById('logout-button');

    const API_URL = 'http://pillaimanish.cloud:8081/api/auth';

    // Check for a stored token on page load
    const token = localStorage.getItem('jwt');
    if (token) {
        showMainView();
        fetchEmails();
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
            fetchEmails();
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
        emailContent.innerHTML = '';
        loginError.textContent = '';
    }

    function showMainView() {
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'block';
    }

    // --- API Functions ---

    async function fetchEmails() {
        try {
            const token = localStorage.getItem('jwt');
            const response = await fetch(`${API_URL}/emails`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch emails.');
            }

            const emails = await response.json();
            displayEmails(emails);
        } catch (error) {
            console.error(error);
            if (String(error).includes('401')) {
                showLoginView();
            }
        }
    }

    function displayEmails(emails) {
        emailList.innerHTML = ''; // Clear previous list
        if (!emails || emails.length === 0) {
            emailList.innerHTML = '<li>No emails found.</li>';
            return;
        }

        emails.forEach(email => {
            const li = document.createElement('li');
            li.dataset.id = email.ID;

            const subject = document.createElement('div');
            subject.className = 'email-subject';
            subject.textContent = email.subject || '(No Subject)';

            const from = document.createElement('div');
            from.className = 'email-from';
            from.textContent = `From: ${email.from}`;

            li.appendChild(subject);
            li.appendChild(from);

            li.addEventListener('click', () => fetchEmailContent(email.ID));
            emailList.appendChild(li);
        });
    }

    async function fetchEmailContent(emailId) {
        try {
            const token = localStorage.getItem('jwt');
            const response = await fetch(`${API_URL}/emails/${emailId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch email content.');
            }

            const rawEmail = await response.text();
            renderEmail(rawEmail);
        } catch (error) {
            console.error('Error fetching or rendering email:', error);
            emailContent.innerHTML = '<p>Could not load email content.</p>';
        }
    }

    function renderEmail(rawEmail) {
        emailContent.innerHTML = ''; // Clear previous content

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
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            emailContent.appendChild(iframe);
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
            emailContent.appendChild(mainPre);

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
                emailContent.appendChild(details);
            }
        } else {
            emailContent.innerHTML = '<pre>Could not display email content.</pre>';
        }
    }
});
