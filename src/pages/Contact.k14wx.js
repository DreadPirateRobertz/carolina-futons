// Contact.k14wx.js - Contact Page
// Contact form with validation, illustrated map section,
// business hours, and local SEO schema
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { sendEmail } from 'backend/emailService.web';
import { submitContactForm } from 'backend/contactSubmissions.web';
import { trackEvent } from 'public/engagementTracker';

$w.onReady(async function () {
  initContactForm();
  initBusinessInfo();
  await injectContactSchema();
  trackEvent('page_view', { page: 'contact' });
});

// ── Contact Form ────────────────────────────────────────────────────
// Validated form that sends to store email

function initContactForm() {
  try {
    const submitBtn = $w('#contactSubmit');
    if (!submitBtn) return;

    submitBtn.onClick(async () => {
      // Validate required fields
      const name = $w('#contactName').value?.trim();
      const email = $w('#contactEmail').value?.trim();
      const phone = $w('#contactPhone').value?.trim();
      const subject = $w('#contactSubject').value?.trim();
      const message = $w('#contactMessage').value?.trim();

      // Clear previous errors
      hideAllErrors();

      let hasError = false;

      if (!name) {
        showFieldError('#contactNameError', 'Please enter your name');
        hasError = true;
      }
      if (!email || !isValidEmail(email)) {
        showFieldError('#contactEmailError', 'Please enter a valid email address');
        hasError = true;
      }
      if (!message) {
        showFieldError('#contactMessageError', 'Please enter your message');
        hasError = true;
      }

      if (hasError) return;

      // Disable button during submission
      submitBtn.disable();
      submitBtn.label = 'Sending...';

      try {
        await sendEmail({
          name,
          email,
          phone: phone || 'Not provided',
          subject: subject || 'Website Contact Form',
          message,
        });

        // Also save to CMS for dashboard review
        submitContactForm({
          name,
          email,
          phone: phone || '',
          source: 'contact_page',
          status: 'new',
          notes: `Subject: ${subject || 'General'}\n\n${message}`,
        }).catch(() => {});

        trackEvent('contact_form_submit', { subject: subject || 'general' });

        // Show success message
        try {
          $w('#contactSuccess').show('fade', { duration: 300 });
          $w('#contactForm').hide('fade', { duration: 300 });
        } catch (e) {}
      } catch (err) {
        console.error('Error sending contact form:', err);
        try {
          $w('#contactError').text = 'Something went wrong. Please call us at (828) 252-9449.';
          $w('#contactError').show();
        } catch (e) {}
      } finally {
        submitBtn.enable();
        submitBtn.label = 'Send Message';
      }
    });
  } catch (e) {}
}

function showFieldError(elementId, message) {
  try {
    $w(elementId).text = message;
    $w(elementId).show();
  } catch (e) {}
}

function hideAllErrors() {
  ['#contactNameError', '#contactEmailError', '#contactMessageError', '#contactError'].forEach(id => {
    try { $w(id).hide(); } catch (e) {}
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Business Info Display ───────────────────────────────────────────

function initBusinessInfo() {
  const info = {
    address: '824 Locust St, Ste 200\nHendersonville, NC 28792',
    phone: '(828) 252-9449',
    hours: 'Wednesday - Saturday\n10:00 AM - 5:00 PM',
    email: '', // Add store email when available
  };

  try { $w('#infoAddress').text = info.address; } catch (e) {}
  try { $w('#infoPhone').text = info.phone; } catch (e) {}
  try { $w('#infoHours').text = info.hours; } catch (e) {}

  // Phone click-to-call
  try {
    $w('#infoPhoneLink').onClick(() => {
      import('wix-window-frontend').then(({ openUrl }) => openUrl('tel:+18282529449'));
    });
  } catch (e) {}

  // Directions button
  try {
    $w('#directionsBtn').onClick(() => {
      import('wix-window-frontend').then(({ openUrl }) => {
        openUrl('https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792');
      });
    });
  } catch (e) {}
}

// ── Schema Injection ────────────────────────────────────────────────

async function injectContactSchema() {
  try {
    const schema = await getBusinessSchema();
    if (schema) {
      $w('#contactSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
