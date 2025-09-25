import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';

const PaymentAdjustmentModal = ({
  isOpen,
  toggle,
  paymentInfo,
  newAmount,
  onConfirm,
  isLoading = false,
  transactionType = 'transaction'
}) => {
  const [selectedChoice, setSelectedChoice] = React.useState('adjust_payment');

  const handleConfirm = () => {
    onConfirm(selectedChoice);
  };

  const formatCurrency = (amount) => {
    return `₹ ${parseFloat(amount || 0).toFixed(2)}`;
  };

  console.log('🔍 PaymentAdjustmentModal received props:', {
    isOpen,
    paymentInfo,
    newAmount,
    transactionType,
    totalAllocatedAmount: paymentInfo?.totalAllocatedAmount,
    keepPaymentText: `Keep Payment amount to ${formatCurrency(paymentInfo?.totalAllocatedAmount)}`
  });
  
  if (!paymentInfo) {
    console.log('❌ PaymentAdjustmentModal: paymentInfo is null/undefined, returning null');
    return null;
  }

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered>
      <ModalHeader toggle={toggle} className="border-bottom">
        <div className="d-flex align-items-center">
          <i className="ri-alert-line me-2 text-warning fs-18"></i>
          Attention: Payment Changes
        </div>
      </ModalHeader>
      
      <ModalBody>
        <div className="text-center mb-3">
          <div className="avatar-md mx-auto mb-3">
            <div className="avatar-title bg-warning-subtle text-warning rounded-circle fs-24">
              <i className="ri-alert-line"></i>
            </div>
          </div>
          <h5 className="mb-2">Payment Changes Required</h5>
          <p className="text-muted mb-3">
            This {transactionType} is paid through{' '}
            <strong>Payment#{paymentInfo.allocations?.[0]?.paymentNumber}</strong>. 
            As amount is changed, would you like to change Payment amount too?
          </p>
        </div>

        <div className="bg-light rounded p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <span className="text-muted">Current Payment Amount:</span>
            <span className="fw-semibold">{formatCurrency(paymentInfo.totalAllocatedAmount)}</span>
          </div>
          <div className="d-flex align-items-center justify-content-between">
            <span className="text-muted">New {transactionType} Amount:</span>
            <span className="fw-semibold text-success">{formatCurrency(newAmount)}</span>
          </div>
        </div>

        <div className="mb-3">
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="radio"
              name="paymentChoice"
              id="adjustPayment"
              value="adjust_payment"
              checked={selectedChoice === 'adjust_payment'}
              onChange={(e) => setSelectedChoice(e.target.value)}
            />
            <label className="form-check-label" htmlFor="adjustPayment">
              <span className="fw-semibold">Yes, Change Payment amount to {formatCurrency(newAmount)}</span>
            </label>
          </div>

          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="paymentChoice"
              id="keepPayment"
              value="keep_payment"
              checked={selectedChoice === 'keep_payment'}
              onChange={(e) => setSelectedChoice(e.target.value)}
            />
            <label className="form-check-label" htmlFor="keepPayment">
              <span className="fw-semibold">No, Keep Payment amount to {formatCurrency(paymentInfo.totalAllocatedAmount)}</span>
            </label>
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="border-top">
        <Button
          color="light"
          onClick={toggle}
          disabled={isLoading}
          className="btn w-sm"
        >
          Cancel
        </Button>
        <Button
          color="primary"
          onClick={handleConfirm}
          disabled={isLoading}
          className="btn w-sm"
        >
          {isLoading ? (
            <>
              <i className="ri-loader-2-line spin me-1"></i>
              Processing...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </ModalFooter>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .form-check-label {
          cursor: pointer;
        }
      `}</style>
    </Modal>
  );
};

export default PaymentAdjustmentModal; 