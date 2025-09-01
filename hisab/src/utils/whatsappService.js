import axios from 'axios';

// WhatsApp Business API configuration
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('Missing WhatsApp configuration. WhatsApp features will be disabled.');
}

/**
 * Send a text message via WhatsApp Business API
 * @param {string} recipientPhone - Recipient phone number (with country code, no + sign)
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} API response
 */
export async function sendWhatsAppTextMessage(recipientPhone, message) {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        throw new Error('WhatsApp configuration missing. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables.');
    }

    try {
        const response = await axios.post(
            `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipientPhone.replace(/\D/g, ''), // Remove non-digits
                type: 'text',
                text: {
                    body: message
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`WhatsApp message sent to ${recipientPhone}:`, response.data);
        return response.data;
    } catch (error) {
        console.error('WhatsApp API Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

/**
 * Send a document via WhatsApp Business API
 * @param {string} recipientPhone - Recipient phone number (with country code, no + sign)
 * @param {string} documentUrl - URL of the document to send
 * @param {string} filename - Name of the file
 * @param {string} caption - Optional caption for the document
 * @returns {Promise<Object>} API response
 */
export async function sendWhatsAppDocument(recipientPhone, documentUrl, filename, caption = '') {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        throw new Error('WhatsApp configuration missing. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables.');
    }

    try {
        const response = await axios.post(
            `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipientPhone.replace(/\D/g, ''), // Remove non-digits
                type: 'document',
                document: {
                    link: documentUrl,
                    filename: filename,
                    caption: caption
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`WhatsApp document sent to ${recipientPhone}:`, response.data);
        return response.data;
    } catch (error) {
        console.error('WhatsApp API Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

/**
 * Send a message with buttons via WhatsApp Business API
 * @param {string} recipientPhone - Recipient phone number
 * @param {string} bodyText - Main message text
 * @param {Array} buttons - Array of button objects {id, title}
 * @param {string} headerText - Optional header text
 * @param {string} footerText - Optional footer text
 * @returns {Promise<Object>} API response
 */
export async function sendWhatsAppInteractiveMessage(recipientPhone, bodyText, buttons, headerText = '', footerText = '') {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
        throw new Error('WhatsApp configuration missing. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in environment variables.');
    }

    try {
        const interactive = {
            type: 'button',
            body: {
                text: bodyText
            },
            action: {
                buttons: buttons.map(btn => ({
                    type: 'reply',
                    reply: {
                        id: btn.id,
                        title: btn.title
                    }
                }))
            }
        };

        if (headerText) {
            interactive.header = {
                type: 'text',
                text: headerText
            };
        }

        if (footerText) {
            interactive.footer = {
                text: footerText
            };
        }

        const response = await axios.post(
            `${WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: recipientPhone.replace(/\D/g, ''),
                type: 'interactive',
                interactive: interactive
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`WhatsApp interactive message sent to ${recipientPhone}:`, response.data);
        return response.data;
    } catch (error) {
        console.error('WhatsApp API Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        throw error;
    }
}

/**
 * Validate phone number format for WhatsApp
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} Whether the phone number is valid
 */
export function isValidWhatsAppNumber(phoneNumber) {
    // Remove all non-digits
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid length (7-15 digits as per E.164 standard)
    return cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * Format phone number for WhatsApp API
 * @param {string} phoneNumber - Phone number to format
 * @returns {string} Formatted phone number
 */
export function formatWhatsAppNumber(phoneNumber) {
    // Remove all non-digits
    return phoneNumber.replace(/\D/g, '');
} 