import React from 'react';
import { Input } from 'reactstrap';
import PropTypes from 'prop-types';

/**
 * A reusable filter container component for table columns
 * @param {Object} props - Component props
 * @param {Object} props.column - Column configuration object
 * @param {boolean} props.column.canFilter - Whether the column is filterable
 * @param {function} props.column.render - Render function for the filter
 * @returns {JSX.Element} Filter container component
 */
export const Filter = ({ column }) => {
  if (!column?.canFilter) return null;

  return (
    <div className="filter-container" style={{ marginTop: 5 }}>
      {column.render('Filter')}
    </div>
  );
};

Filter.propTypes = {
  column: PropTypes.shape({
    canFilter: PropTypes.bool.isRequired,
    render: PropTypes.func.isRequired,
  }).isRequired,
};

/**
 * Default text input filter for table columns
 * @param {Object} props - Component props
 * @param {Object} props.column - Column configuration object
 * @param {string} props.column.filterValue - Current filter value
 * @param {function} props.column.setFilter - Function to update filter value
 * @returns {JSX.Element} Text input filter component
 */
export const DefaultColumnFilter = ({
  column: { filterValue, setFilter },
}) => {
  return (
    <Input
      value={filterValue || ''}
      onChange={(e) => {
        setFilter(e.target.value || undefined);
      }}
      placeholder="Search..."
      className="form-control-sm filter-input"
      data-testid="default-filter-input"
    />
  );
};

DefaultColumnFilter.propTypes = {
  column: PropTypes.shape({
    filterValue: PropTypes.any,
    setFilter: PropTypes.func.isRequired,
  }).isRequired,
};

/**
 * Select dropdown filter for table columns
 * @param {Object} props - Component props
 * @param {Object} props.column - Column configuration object
 * @param {string} props.column.filterValue - Current filter value
 * @param {function} props.column.setFilter - Function to update filter value
 * @param {Array} props.column.preFilteredRows - Array of pre-filtered rows
 * @param {string} props.column.id - Column ID
 * @returns {JSX.Element} Select dropdown filter component
 */
export const SelectColumnFilter = ({
  column: { filterValue, setFilter, preFilteredRows, id },
}) => {
  const options = React.useMemo(() => {
    const optionsSet = new Set();
    preFilteredRows.forEach((row) => {
      optionsSet.add(row.values[id]);
    });
    return Array.from(optionsSet.values());
  }, [id, preFilteredRows]);

  return (
    <Input
      type="select"
      value={filterValue}
      onChange={(e) => {
        setFilter(e.target.value || undefined);
      }}
      className="form-control-sm filter-select"
      data-testid="select-filter"
    >
      <option value="">All</option>
      {options.map((option, i) => (
        <option key={`${option}-${i}`} value={option}>
          {String(option)}
        </option>
      ))}
    </Input>
  );
};

SelectColumnFilter.propTypes = {
  column: PropTypes.shape({
    filterValue: PropTypes.any,
    setFilter: PropTypes.func.isRequired,
    preFilteredRows: PropTypes.array.isRequired,
    id: PropTypes.string.isRequired,
  }).isRequired,
};

/**
 * Custom number range filter component
 * @param {Object} props - Component props
 * @param {Object} props.column - Column configuration object
 * @param {Array} props.column.filterValue - Current filter range [min, max]
 * @param {function} props.column.setFilter - Function to update filter range
 * @param {Array} props.column.preFilteredRows - Array of pre-filtered rows
 * @param {string} props.column.id - Column ID
 * @returns {JSX.Element} Number range filter component
 */
export const NumberRangeColumnFilter = ({
  column: { filterValue = [], setFilter, preFilteredRows, id },
}) => {
  const [min, max] = React.useMemo(() => {
    let min = preFilteredRows.length ? preFilteredRows[0].values[id] : 0;
    let max = min;
    preFilteredRows.forEach((row) => {
      min = Math.min(row.values[id], min);
      max = Math.max(row.values[id], max);
    });
    return [min, max];
  }, [id, preFilteredRows]);

  return (
    <div className="number-range-filter">
      <Input
        type="number"
        value={filterValue[0] || ''}
        onChange={(e) => {
          const val = e.target.value;
          setFilter((old = []) => [val ? parseInt(val, 10) : undefined, old[1]]);
        }}
        placeholder={`Min (${min})`}
        className="form-control-sm"
        style={{ marginBottom: '0.25rem' }}
      />
      <Input
        type="number"
        value={filterValue[1] || ''}
        onChange={(e) => {
          const val = e.target.value;
          setFilter((old = []) => [old[0], val ? parseInt(val, 10) : undefined]);
        }}
        placeholder={`Max (${max})`}
        className="form-control-sm"
      />
    </div>
  );
};

NumberRangeColumnFilter.propTypes = {
  column: PropTypes.shape({
    filterValue: PropTypes.array,
    setFilter: PropTypes.func.isRequired,
    preFilteredRows: PropTypes.array.isRequired,
    id: PropTypes.string.isRequired,
  }).isRequired,
};

export default {
  Filter,
  DefaultColumnFilter,
  SelectColumnFilter,
  NumberRangeColumnFilter,
};