import React from 'react';
import { FormFeedback, Label, Input } from 'reactstrap';
import { RiErrorWarningLine } from 'react-icons/ri';

export const FormField = ({ label, name, type, placeholder, validation, icon }) => (
    <div className="mb-3">
        <Label htmlFor={name} className="form-label">
            {icon} {label}
        </Label>
        <Input
            type={type}
            className="form-control"
            id={name}
            name={name}
            placeholder={placeholder}
            onChange={validation.handleChange}
            onBlur={validation.handleBlur}
            value={validation.values[name]}
            invalid={validation.touched[name] && validation.errors[name] ? true : false}
        />
        {validation.touched[name] && validation.errors[name] && (
            <FormFeedback type="invalid">
                <RiErrorWarningLine className="me-1" />
                {validation.errors[name]}
            </FormFeedback>
        )}
    </div>
);

export const SelectField = ({ label, name, options, validation, icon }) => (
    <div className="mb-3">
        <Label htmlFor={name} className="form-label">
            {icon} {label}
        </Label>
        <Input
            type="select"
            className="form-select"
            id={name}
            name={name}
            onChange={validation.handleChange}
            onBlur={validation.handleBlur}
            value={validation.values[name]}
            invalid={validation.touched[name] && validation.errors[name] ? true : false}
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </Input>
        {validation.touched[name] && validation.errors[name] && (
            <FormFeedback type="invalid">
                <RiErrorWarningLine className="me-1" />
                {validation.errors[name]}
            </FormFeedback>
        )}
    </div>
);