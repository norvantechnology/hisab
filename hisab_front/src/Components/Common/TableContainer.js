import React, { Fragment, useEffect, useState } from "react";
import { CardBody, Col, Row, Table } from "reactstrap";
import { Link } from "react-router-dom";

import {
  // Table as ReactTable,
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender
} from '@tanstack/react-table';

import { rankItem } from '@tanstack/match-sorter-utils';

import {
  ProductsGlobalFilter,
  CustomersGlobalFilter,
  OrderGlobalFilter,
  ContactsGlobalFilter,
  CompaniesGlobalFilter,
  LeadsGlobalFilter,
  CryptoOrdersGlobalFilter,
  InvoiceListGlobalSearch,
  TicketsListGlobalFilter,
  NFTRankingGlobalFilter,
  TaskListGlobalFilter,
} from "../../Components/Common/GlobalSearchFilter";

const Filter = ({ column }) => {
  const columnFilterValue = column.getFilterValue();

  return (
    <DebouncedInput
      type="text"
      value={(columnFilterValue ?? '')}
      onChange={value => column.setFilterValue(value)}
      placeholder={`Search...`}
      className="w-36 border shadow rounded"
      list={column.id + 'list'}
    />
  );
};


// Global Filter Component
const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <input
      {...props}
      value={value}
      onChange={e => setValue(e.target.value)}
      className="form-control search"
    />
  );
};
const TableContainer = ({
  columns,
  data,
  isGlobalFilter,
  isProductsFilter,
  isCustomerFilter,
  isOrderFilter,
  isContactsFilter,
  isCompaniesFilter,
  isLeadsFilter,
  isCryptoOrdersFilter,
  isInvoiceListFilter,
  isTicketsListFilter,
  isNFTRankingFilter,
  isTaskListFilter,
  customPageSize,
  tableClass,
  theadClass,
  trClass,
  thClass,
  divClass,
  SearchPlaceholder,
  // Server-side pagination props
  pagination,
  handlePageChange,
  serverSide = false,
}) => {
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const fuzzyFilter = (row, columnId, value, addMeta) => {
    const itemRank = rankItem(row.getValue(columnId), value);
    addMeta({
      itemRank
    });
    return itemRank.passed;
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      globalFilter,
    },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Add column filter definitions
    getColumnCanGlobalFilter: column => column.getCanGlobalFilter(),
    getColumnCanFilter: column => column.getCanFilter(),
    // Disable internal pagination for server-side
    manualPagination: serverSide,
  });

  const {
    getHeaderGroups,
    getRowModel,
    getCanPreviousPage,
    getCanNextPage,
    getPageOptions,
    setPageIndex,
    nextPage,
    previousPage,
    setPageSize,
    getState
  } = table;

  useEffect(() => {
    (customPageSize) && setPageSize((customPageSize));
  }, [customPageSize, setPageSize]);

  // Server-side pagination calculations
  const getServerSidePaginationInfo = () => {
    if (serverSide && pagination) {
      const startRecord = ((pagination.currentPage - 1) * pagination.limit) + 1;
      const endRecord = Math.min(pagination.currentPage * pagination.limit, pagination.total);
      
      return {
        startRecord,
        endRecord,
        total: pagination.total,
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        canPrevious: pagination.currentPage > 1,
        canNext: pagination.currentPage < pagination.totalPages
      };
    }
    return null;
  };

  // Generate page numbers for server-side pagination
  const generateServerSidePageNumbers = () => {
    if (!serverSide || !pagination) return [];
    
    const pages = [];
    const totalPages = pagination.totalPages;
    const currentPage = pagination.currentPage;
    
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        if (totalPages > 4) pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        if (totalPages > 4) pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const serverSideInfo = getServerSidePaginationInfo();
  const serverSidePages = generateServerSidePageNumbers();

  return (
    <Fragment>
      {isGlobalFilter && <Row className="mb-3">
        <CardBody className="border border-dashed border-end-0 border-start-0">
          <form>
            <Row>
              <Col sm={5}>
                <div className={(isProductsFilter || isContactsFilter || isCompaniesFilter || isNFTRankingFilter) ? "search-box me-2 mb-2 d-inline-block" : "search-box me-2 mb-2 d-inline-block col-12"}>
                  <DebouncedInput
                    value={globalFilter ?? ''}
                    onChange={value => setGlobalFilter((value))}
                    placeholder={SearchPlaceholder}
                  />
                  <i className="bx bx-search-alt search-icon"></i>
                </div>
              </Col>
              {isProductsFilter && (
                <ProductsGlobalFilter />
              )}
              {isCustomerFilter && (
                <CustomersGlobalFilter />
              )}
              {isOrderFilter && (
                <OrderGlobalFilter />
              )}
              {isContactsFilter && (
                <ContactsGlobalFilter />
              )}
              {isCompaniesFilter && (
                <CompaniesGlobalFilter />
              )}
              {isLeadsFilter && (
                <LeadsGlobalFilter />
              )}
              {isCryptoOrdersFilter && (
                <CryptoOrdersGlobalFilter />
              )}
              {isInvoiceListFilter && (
                <InvoiceListGlobalSearch />
              )}
              {isTicketsListFilter && (
                <TicketsListGlobalFilter />
              )}
              {isNFTRankingFilter && (
                <NFTRankingGlobalFilter />
              )}
              {isTaskListFilter && (
                <TaskListGlobalFilter />
              )}
            </Row>
          </form>
        </CardBody>
      </Row>}

      <div className={divClass}>
        <Table hover className={tableClass}>
          <thead className={theadClass}>
            {getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className={thClass}>
                    <div onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                    </div>
                    {header.column.getCanFilter() && (
                      <div className="mt-1">
                        {header.column.columnDef.meta?.filterComponent ? (
                          flexRender(
                            header.column.columnDef.meta.filterComponent,
                            { column: header.column }
                          )
                        ) : null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {getRowModel().rows.map((row) => {
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      <Row className="align-items-center mt-2 g-3 text-center text-sm-start">
        <div className="col-sm">
          <div className="text-muted">
            Showing <span className="fw-semibold ms-1">
              {serverSide && serverSideInfo ? serverSideInfo.startRecord : 1}
            </span> to <span className="fw-semibold">
              {serverSide && serverSideInfo ? serverSideInfo.endRecord : getState().pagination.pageSize}
            </span> of <span className="fw-semibold">
              {serverSide && serverSideInfo ? serverSideInfo.total : data.length}
            </span> Results
          </div>
        </div>
        <div className="col-sm-auto">
          <ul className="pagination pagination-separated pagination-md justify-content-center justify-content-sm-start mb-0">
            <li className={serverSide ? (serverSideInfo && !serverSideInfo.canPrevious ? "page-item disabled" : "page-item") : (!getCanPreviousPage() ? "page-item disabled" : "page-item")}>
              <button 
                className="page-link" 
                onClick={() => {
                  if (serverSide) {
                    if (serverSideInfo && serverSideInfo.canPrevious) {
                      handlePageChange(serverSideInfo.currentPage - 1);
                    }
                  } else {
                    previousPage();
                  }
                }}
                disabled={serverSide ? (serverSideInfo && !serverSideInfo.canPrevious) : !getCanPreviousPage()}
              >
                Previous
              </button>
            </li>

            {serverSide ? (
              serverSidePages.map((page, index) => (
                <React.Fragment key={index}>
                  {page === '...' ? (
                    <li className="page-item disabled">
                      <span className="page-link">...</span>
                    </li>
                  ) : (
                    <li className="page-item">
                      <button 
                        className={serverSideInfo && serverSideInfo.currentPage === page ? "page-link active" : "page-link"} 
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    </li>
                  )}
                </React.Fragment>
              ))
            ) : (
              getPageOptions().map((item, key) => (
                <React.Fragment key={key}>
                  <li className="page-item">
                    <button 
                      className={getState().pagination.pageIndex === item ? "page-link active" : "page-link"} 
                      onClick={() => setPageIndex(item)}
                    >
                      {item + 1}
                    </button>
                  </li>
                </React.Fragment>
              ))
            )}

            <li className={serverSide ? (serverSideInfo && !serverSideInfo.canNext ? "page-item disabled" : "page-item") : (!getCanNextPage() ? "page-item disabled" : "page-item")}>
              <button 
                className="page-link" 
                onClick={() => {
                  if (serverSide) {
                    if (serverSideInfo && serverSideInfo.canNext) {
                      handlePageChange(serverSideInfo.currentPage + 1);
                    }
                  } else {
                    nextPage();
                  }
                }}
                disabled={serverSide ? (serverSideInfo && !serverSideInfo.canNext) : !getCanNextPage()}
              >
                Next
              </button>
            </li>
          </ul>
        </div>
      </Row>
    </Fragment>
  );
};

export default TableContainer;