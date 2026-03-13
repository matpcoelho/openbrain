const API_DEFAULT = 'https://txojvogstovmmwnlnqhy.supabase.co/functions/v1/brain-api';

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ apiUrl: API_DEFAULT, apiKey: '' }, items => {
    document.getElementById('apiUrl').value = items.apiUrl;
    document.getElementById('apiKey').value = items.apiKey;
  });
});

document.getElementById('save').addEventListener('click', () => {
  const apiUrl = document.getElementById('apiUrl').value.trim() || API_DEFAULT;
  const apiKey = document.getElementById('apiKey').value.trim();

  chrome.storage.sync.set({ apiUrl, apiKey }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Saved ✓';
    setTimeout(() => status.textContent = '', 2000);
  });
});
