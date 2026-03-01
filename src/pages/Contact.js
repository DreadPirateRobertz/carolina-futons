// Contact.js - Contact Page
// Contact form with enhanced validation, business hours with live status,
// showroom info, appointment booking, social proof, FAQ link, and local SEO
import { getBusinessSchema, getPageTitle, getCanonicalUrl, getPageMetaDescription } from 'backend/seoHelpers.web';
import { sendEmail } from 'backend/emailService.web';
import { submitContactForm } from 'backend/contactSubmissions.web';
import {
  getAvailableAppointmentSlots,
  bookAppointment,
  getVisitTypes,
} from 'backend/deliveryScheduling.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { sanitizeText } from 'public/validators';
import {
  validateContactFields,
  getShowroomDetails,
  formatBusinessHours,
  getSocialProofSnippets,
} from 'public/aboutContactHelpers.js';

$w.onReady(async function () {
  initBackToTop($w);
  initContactForm();
  initBusinessInfo();
  initBusinessHoursDisplay();
  initAppointmentBooking();
  initContactSocialProof();
  initContactFaqLink();
  await Promise.allSettled([
    injectContactSchema(),
    injectContactMeta(),
  ]);
  trackEvent('page_view', { page: 'contact' });
});

// ── Contact Form ────────────────────────────────────────────────────
// Validated form using extracted validation helpers

function initContactForm() {
  try {
    const submitBtn = $w('#contactSubmit');
    if (!submitBtn) return;

    try { $w('#contactName').accessibility.ariaLabel = 'Your name'; } catch (e) {}
    try { $w('#contactName').accessibility.ariaDescribedBy = 'contactNameError'; } catch (e) {}
    try { $w('#contactName').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#contactEmail').accessibility.ariaLabel = 'Your email address'; } catch (e) {}
    try { $w('#contactEmail').accessibility.ariaDescribedBy = 'contactEmailError'; } catch (e) {}
    try { $w('#contactEmail').accessibility.ariaRequired = true; } catch (e) {}
    try { $w('#contactPhone').accessibility.ariaLabel = 'Your phone number (optional)'; } catch (e) {}
    try { $w('#contactSubject').accessibility.ariaLabel = 'Message subject (optional)'; } catch (e) {}
    try { $w('#contactMessage').accessibility.ariaLabel = 'Your message'; } catch (e) {}
    try { $w('#contactMessage').accessibility.ariaDescribedBy = 'contactMessageError'; } catch (e) {}
    try { $w('#contactMessage').accessibility.ariaRequired = true; } catch (e) {}
    try { submitBtn.accessibility.ariaLabel = 'Send message to Carolina Futons'; } catch (e) {}

    submitBtn.onClick(async () => {
      const name = sanitizeText($w('#contactName').value, 200);
      const email = $w('#contactEmail').value?.trim();
      const phone = sanitizeText($w('#contactPhone').value, 30);
      const subject = sanitizeText($w('#contactSubject').value, 200);
      const message = sanitizeText($w('#contactMessage').value, 5000);

      // Clear previous errors
      hideAllErrors();

      // Use extracted validation
      const validation = validateContactFields({ name, email, message, phone });

      if (!validation.valid) {
        for (const err of validation.errors) {
          const errorMap = {
            name: '#contactNameError',
            email: '#contactEmailError',
            message: '#contactMessageError',
            phone: '#contactPhoneError',
          };
          if (errorMap[err.field]) {
            showFieldError(errorMap[err.field], err.message);
          }
        }
        announce($w, 'Please fix the errors in the form');
        return;
      }

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
        }).catch(err => console.error('[Contact] CMS form save failed:', err.message));

        trackEvent('contact_form_submit', { subject: subject || 'general' });

        // Show success message
        try {
          $w('#contactSuccess').show('fade', { duration: 300 });
          $w('#contactForm').hide('fade', { duration: 300 });
          announce($w, 'Message sent successfully. We will respond within 24 hours.');
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
    try { $w(elementId).accessibility.ariaLive = 'assertive'; } catch (e) {}
    try { $w(elementId).accessibility.role = 'alert'; } catch (e) {}
  } catch (e) {}
}

function hideAllErrors() {
  ['#contactNameError', '#contactEmailError', '#contactMessageError', '#contactPhoneError', '#contactError'].forEach(id => {
    try { $w(id).hide(); } catch (e) {}
  });
}

// ── Business Info Display ───────────────────────────────────────────

function initBusinessInfo() {
  const details = getShowroomDetails();

  try { $w('#infoAddress').text = details.address; } catch (e) {}
  try { $w('#infoPhone').text = details.phone; } catch (e) {}

  // Showroom features
  try {
    const featuresList = $w('#contactFeatures');
    if (featuresList) {
      featuresList.onItemReady(($item, itemData) => {
        try { $item('#featureItem').text = itemData.text; } catch (e) {}
      });
      featuresList.data = details.features.map((f, i) => ({ _id: `cf-${i}`, text: f }));
    }
  } catch (e) {}

  // Phone click-to-call
  try {
    $w('#infoPhoneLink').onClick(() => {
      import('wix-window-frontend').then(({ openUrl }) => openUrl(details.telLink));
    });
    try { $w('#infoPhoneLink').accessibility.ariaLabel = `Call Carolina Futons at ${details.phone}`; } catch (e) {}
  } catch (e) {}

  // Directions button
  try {
    $w('#directionsBtn').onClick(() => {
      import('wix-window-frontend').then(({ openUrl }) => openUrl(details.directionsUrl));
    });
    try { $w('#directionsBtn').accessibility.ariaLabel = 'Get directions to our showroom'; } catch (e) {}
  } catch (e) {}
}

// ── Business Hours with Live Status ─────────────────────────────────

function initBusinessHoursDisplay() {
  try {
    const hours = formatBusinessHours();

    // Today's open/closed status
    try { $w('#todayStatus').text = hours.todayStatus; } catch (e) {}

    // Full weekly schedule
    try {
      const hoursRepeater = $w('#hoursRepeater');
      if (hoursRepeater) {
        hoursRepeater.onItemReady(($item, itemData) => {
          try { $item('#hourDay').text = itemData.day; } catch (e) {}
          try { $item('#hourTime').text = itemData.time; } catch (e) {}
        });
        hoursRepeater.data = hours.schedule.map((h, i) => ({ ...h, _id: `hr-${i}` }));
      }
    } catch (e) {}
  } catch (e) {}
}

// ── Social Proof ────────────────────────────────────────────────────

function initContactSocialProof() {
  try {
    const repeater = $w('#contactTestimonials');
    if (!repeater) return;

    const snippets = getSocialProofSnippets();
    try { repeater.accessibility.ariaLabel = 'Customer testimonials'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#testimonialQuote').text = `"${itemData.quote}"`; } catch (e) {}
      try { $item('#testimonialAuthor').text = `— ${itemData.author}`; } catch (e) {}
      try { $item('#testimonialStars').text = '★'.repeat(itemData.rating) + '☆'.repeat(5 - itemData.rating); } catch (e) {}
    });
    repeater.data = snippets.map((s, i) => ({ ...s, _id: `ct-${i}` }));
  } catch (e) {}
}

// ── FAQ Link ────────────────────────────────────────────────────────

function initContactFaqLink() {
  try {
    const faqLink = $w('#contactFaqLink');
    if (!faqLink) return;

    makeClickable(faqLink, () => {
      import('wix-location-frontend').then(({ to }) => to('/faq'));
    }, { ariaLabel: 'Visit our frequently asked questions page', role: 'link' });
  } catch (e) {}
}

// ── Showroom Appointment Booking ────────────────────────────────────

function initAppointmentBooking() {
  try {
    const bookBtn = $w('#appointmentBookBtn');
    if (!bookBtn) return;

    loadVisitTypes();

    try {
      $w('#appointmentVisitType').onChange(() => loadAppointmentSlots());
    } catch (e) {}

    try {
      $w('#appointmentDate').onChange(() => loadAppointmentSlots());
    } catch (e) {}

    bookBtn.onClick(async () => {
      const name = sanitizeText($w('#appointmentName').value, 200);
      const email = $w('#appointmentEmail').value?.trim();
      const phone = sanitizeText($w('#appointmentPhone').value, 30);
      const visitType = $w('#appointmentVisitType').value;
      const date = $w('#appointmentDate').value;
      const timeSlot = $w('#appointmentTimeSlot').value;
      const interests = sanitizeText($w('#appointmentInterests').value, 1000);

      try { $w('#appointmentError').hide(); } catch (e) {}

      if (!name || !email || !visitType || !date || !timeSlot) {
        try {
          $w('#appointmentError').text = 'Please fill in all required fields.';
          $w('#appointmentError').show();
        } catch (e) {}
        return;
      }

      const emailCheck = validateContactFields({ name, email, message: 'placeholder' });
      if (emailCheck.errors.some(e => e.field === 'email')) {
        try {
          $w('#appointmentError').text = 'Please enter a valid email address.';
          $w('#appointmentError').show();
        } catch (e) {}
        return;
      }

      bookBtn.disable();
      bookBtn.label = 'Booking...';

      try {
        const result = await bookAppointment({
          date,
          timeSlot,
          visitType,
          customerName: name,
          customerEmail: email,
          customerPhone: phone || '',
          productInterests: interests || '',
        });

        if (result.success) {
          trackEvent('appointment_booked', { visitType, date });

          try {
            const conf = result.confirmation;
            $w('#appointmentConfirmation').text =
              `Your ${conf.visitLabel} is confirmed for ${conf.dayOfWeek}, ${conf.date} at ${conf.timeLabel}.\n\n` +
              `Location: ${conf.address}\nPhone: ${conf.phone}\n\n` +
              'A confirmation email will be sent shortly. ' +
              'To cancel or reschedule, use the link in your confirmation email.';
            $w('#appointmentForm').hide('fade', { duration: 300 });
            $w('#appointmentSuccess').show('fade', { duration: 300 });
          } catch (e) {}
        } else {
          try {
            $w('#appointmentError').text = result.message || 'Unable to book. Please call (828) 252-9449.';
            $w('#appointmentError').show();
          } catch (e) {}
        }
      } catch (err) {
        console.error('Error booking appointment:', err);
        try {
          $w('#appointmentError').text = 'Something went wrong. Please call us at (828) 252-9449.';
          $w('#appointmentError').show();
        } catch (e) {}
      } finally {
        bookBtn.enable();
        bookBtn.label = 'Book Visit';
      }
    });
  } catch (e) {}
}

async function loadVisitTypes() {
  try {
    const types = await getVisitTypes();
    if (!types || !types.length) return;
    $w('#appointmentVisitType').options = types.map(t => ({
      label: `${t.label} (${t.duration} min)`,
      value: t.value,
    }));
  } catch (e) {}
}

async function loadAppointmentSlots() {
  try {
    const visitType = $w('#appointmentVisitType').value;
    if (!visitType) return;

    const slots = await getAvailableAppointmentSlots(visitType);
    if (!slots || !slots.length) {
      $w('#appointmentTimeSlot').options = [{ label: 'No slots available', value: '' }];
      return;
    }

    const dates = [...new Set(slots.map(s => s.date))];
    $w('#appointmentDate').options = dates.map(d => {
      const slot = slots.find(s => s.date === d);
      return { label: slot ? `${slot.dayOfWeek}, ${d}` : d, value: d };
    });

    const selectedDate = $w('#appointmentDate').value || dates[0];
    if (!$w('#appointmentDate').value && dates[0]) {
      $w('#appointmentDate').value = dates[0];
    }

    const dateSlots = slots.filter(s => s.date === selectedDate);
    $w('#appointmentTimeSlot').options = dateSlots.map(s => ({
      label: `${s.timeLabel} (${s.spotsLeft} ${s.spotsLeft === 1 ? 'spot' : 'spots'} left)`,
      value: s.timeSlot,
    }));
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

async function injectContactMeta() {
  try {
    const [title, description, canonical] = await Promise.all([
      getPageTitle('contact'),
      getPageMetaDescription('contact'),
      getCanonicalUrl('contact'),
    ]);
    try { $w('#contactMetaHtml').postMessage(JSON.stringify({ title, description, canonical })); } catch (e) {}
  } catch (e) {}
}
