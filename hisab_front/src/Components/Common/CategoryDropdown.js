import React from 'react';
import ReactSelect from 'react-select';

const CategoryDropdown = ({
    categories = [],
    value,
    onChange,
    onBlur,
    onAddCategory,
    placeholder = "Select Category",
    className = "",
    classNamePrefix = "react-select",
    isDisabled = false,
    isClearable = true,
    isInvalid = false,
    addNewLabel = "Add New Category",
    noOptionsMessage = "No categories found",
    includeAddOption = true
}) => {
    // Get the selected option object
    const getSelectedValue = () => {
        if (!value) return null;
        const category = categories.find(c => String(c.id) === String(value));
        return category ? { value: category.id, label: category.name } : null;
    };

    // Create options array
    const options = [
        ...categories.map(category => ({
            value: category.id,
            label: category.name
        })),
        ...(includeAddOption ? [{
            value: 'add_new',
            label: addNewLabel,
            isAddOption: true
        }] : [])
    ];

    // Handle option selection
    const handleChange = (selectedOption) => {
        if (selectedOption?.isAddOption) {
            if (onAddCategory) {
                onAddCategory();
            }
        } else {
            if (onChange) {
                onChange(selectedOption?.value || '');
            }
        }
    };

    // Custom option component to style the "Add New" option
    const formatOptionLabel = (option) => {
        if (option.isAddOption) {
            return (
                <div style={{ 
                    color: '#007bff', 
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>+ {option.label}</span>
                </div>
            );
        }
        return option.label;
    };

    return (
        <ReactSelect
            options={options}
            value={getSelectedValue()}
            onChange={handleChange}
            onBlur={onBlur}
            className={`react-select-container ${className} ${isInvalid ? 'is-invalid' : ''}`}
            classNamePrefix={classNamePrefix}
            placeholder={placeholder}
            isClearable={isClearable}
            isDisabled={isDisabled}
            noOptionsMessage={() => noOptionsMessage}
            formatOptionLabel={formatOptionLabel}
            styles={{
                option: (provided, state) => ({
                    ...provided,
                    backgroundColor: state.isSelected 
                        ? '#007bff' 
                        : state.isFocused && state.data.isAddOption 
                        ? '#f8f9fa' 
                        : state.isFocused 
                        ? '#e9ecef' 
                        : 'white',
                    color: state.isSelected 
                        ? 'white' 
                        : state.data.isAddOption 
                        ? '#007bff' 
                        : '#495057',
                    cursor: 'pointer',
                    '&:hover': {
                        backgroundColor: state.data.isAddOption ? '#f8f9fa' : '#e9ecef'
                    }
                })
            }}
        />
    );
};

export default CategoryDropdown; 