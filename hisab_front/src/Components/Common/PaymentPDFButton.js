import React, { useState } from 'react';
import { Button, Spinner, UncontrolledTooltip } from 'reactstrap';
import { generatePaymentInvoicePDF } from '../../services/payment';

const PaymentPDFButton = ({ 
    paymentId, 
    paymentNumber,
    size = "sm", 
    variant = "outline-info",
    showText = false,
    onSuccess = null,
    onError = null 
}) => {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGeneratePDF = async () => {
        if (!paymentId) {
            console.error('Payment ID is required');
            if (onError) onError('Payment ID is required');
            return;
        }

        setIsGenerating(true);

        try {
            console.log('Requesting PDF for payment:', paymentId);
            
            // Backend automatically handles fresh vs cached logic
            const response = await generatePaymentInvoicePDF(paymentId);
            
            if (response?.success && response?.pdfUrl) {
                const actionType = response.cached ? 'retrieved from cache' : 'generated successfully';
                console.log(`Payment PDF ${actionType}:`, response.pdfUrl);
                
                // Open PDF in new tab
                window.open(response.pdfUrl, '_blank');
                
                if (onSuccess) {
                    onSuccess({
                        ...response,
                        actionType: response.cached ? 'cached' : 'generated'
                    });
                }
            } else {
                throw new Error(response?.message || 'Failed to generate payment PDF');
            }
        } catch (error) {
            console.error('Payment PDF generation error:', error);
            
            const errorMessage = error?.message || 'Failed to generate payment invoice PDF';
            
            if (onError) {
                onError(errorMessage);
            } else {
                // Show default error handling
                alert(`Error: ${errorMessage}`);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const buttonId = `payment-pdf-btn-${paymentId}`;

    return (
        <>
            <Button
                id={buttonId}
                color={variant}
                size={size}
                onClick={handleGeneratePDF}
                disabled={isGenerating || !paymentId}
                className="d-flex align-items-center gap-1"
            >
                {isGenerating ? (
                    <Spinner size="sm" />
                ) : (
                    <i className="ri-file-pdf-line"></i>
                )}
                {showText && (
                    <span>{isGenerating ? 'Processing...' : 'PDF'}</span>
                )}
            </Button>
            
            <UncontrolledTooltip placement="top" target={buttonId}>
                {isGenerating 
                    ? 'Processing payment invoice PDF...' 
                    : `Generate PDF invoice for ${paymentNumber || `Payment #${paymentId}`}`
                }
            </UncontrolledTooltip>
        </>
    );
};

export default PaymentPDFButton; 