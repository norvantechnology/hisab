import React from 'react';
import { Button } from 'reactstrap';
import { RiBankLine, RiAddLine } from 'react-icons/ri';

const EmptyState = ({ title, description }) => (
    <div className="py-5 text-center">
        <div className="avatar-xl mx-auto mb-4">
            <div className="avatar-title bg-primary-subtle text-primary rounded-3">
                <RiBankLine size={40} />
            </div>
        </div>
        <h5 className="mt-4 text-primary">{title}</h5>
        <p className="text-muted mb-4">{description}</p>
        <Button color="primary" size="sm">
            <RiAddLine className="me-1" />Add Your First Account
        </Button>
    </div>
);

export default EmptyState;