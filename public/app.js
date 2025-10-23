const chat = document.querySelector('.chat');
const chatToggle = document.getElementById('chatToggle');
const chatlog = document.getElementById('chatlog');
const chatform = document.getElementById('chatform');
const msgInput = document.getElementById('msg');

const history = [];

function addMessage(text, who='bot') {
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.textContent = text;
  chatlog.appendChild(div);
  chatlog.scrollTop = chatlog.scrollHeight;
}

function openSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('visible'));
  const el = document.getElementById(id);
  if (el) el.classList.add('visible');
  document.querySelectorAll('nav a').forEach(a => {
    a.style.textDecoration = (a.dataset.section === id) ? 'underline' : 'none';
  });
}

document.querySelectorAll('nav a').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openSection(a.dataset.section);
  });
});

chatToggle.addEventListener('click', () => {
  chat.classList.toggle('collapsed');
  // Update icon: — for minimize, □ for maximize (simple text icons)
  chatToggle.textContent = chat.classList.contains('collapsed') ? '□' : '—';
});

chatform.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  msgInput.value = '';

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    });
    const data = await res.json();

    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: data.text || '' });

    if (data.action && data.action.action === 'openSection' && data.action.target) {
      openSection(data.action.target);
    }

    addMessage(data.text || '(no reply)', 'bot');
  } catch (err) {
    console.error(err);
    addMessage('Oops — something went wrong. Please try again.', 'bot');
  }
});

// Optional: existing subscribe form integration remains the same
document.getElementById('subscribeForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  if (!email) return;
  // This triggers our rule-based subscribe on the server
  msgInput.value = `subscribe me ${email}`;
  chatform.dispatchEvent(new Event('submit'));
  document.getElementById('subscribeMsg').textContent = 'Sent to the assistant…';
});