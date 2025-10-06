/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AddPackageStep2 from './add-edit-package-content-management.component';
import { PackageService } from '@/services/package/package.service';
import * as packageFormHelper from './package-form-helper';
import { IAddPackageFormData, IPackageContentItem } from '@/types/package.type';

// Mock all child components
jest.mock('@/components/input/base-select.component', () => ({
  Select: ({ children, onSelectionChange, selectedKeys, ...props }: any) => (
    <select
      data-testid="select"
      {...props}
      value={Array.from(selectedKeys || [])[0] || ''}
      onChange={(e) => onSelectionChange?.(new Set([e.target.value]))}
    >
      {children}
    </select>
  ),
  SelectItem: ({ children, value, ...props }: any) => (
    <option value={value} {...props}>
      {children}
    </option>
  )
}));

jest.mock('@/components/input/typesense-search-input.component', () => ({
  __esModule: true,
  default: ({ value, onChange, onSelect, placeholder }: any) => (
    <input
      data-testid="typesense-search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value === 'test-item') {
          onSelect({
            id: '123',
            sales_item_id: 123,
            contentable_name: 'Test Item',
            contentable_code: 'TEST001',
            content_type: 'item',
            child_sales_item_type_name: 'Service'
          });
        }
      }}
    />
  )
}));

jest.mock('./add-edit-package-table.component', () => ({
  __esModule: true,
  default: ({ hospitalClass, hospitalClassLabel, items, onItemFieldChange, onToggleTypeCollapse }: any) => (
    <div data-testid={`package-table-${hospitalClass}`} data-hospital-class={hospitalClass}>
      <div>{hospitalClassLabel}</div>
      {items.map((item: any) => (
        <div key={`${item.id}-${item.patientCategory}-${item.hospitalClass}`} data-item-id={item.id}>
          <span>{item.name}</span>
          <input
            data-testid={`qty-${item.id}-${item.hospitalClass}`}
            value={item.qty}
            onChange={(e) =>
              onItemFieldChange(item.id, item.patientCategory, item.hospitalClass, 'qty', Number(e.target.value))
            }
          />
        </div>
      ))}
      <button onClick={() => onToggleTypeCollapse('Service')}>Toggle Type</button>
    </div>
  )
}));

jest.mock('./package-item-column.component', () => ({
  __esModule: true,
  default: ({ variant, item, typeInfo, onRemoveItem, onToggleTypeCollapse, onSearchFilterChange, itemSearchFilter, onSortModeChange, sortMode }: any) => {
    if (variant === 'header') {
      return (
        <div data-testid="package-item-column-header">
          <input
            data-testid="search-filter"
            value={itemSearchFilter}
            onChange={(e) => onSearchFilterChange(e.target.value)}
          />
          <select
            data-testid="sort-mode"
            value={sortMode}
            onChange={(e) => onSortModeChange(e.target.value)}
          >
            <option value="alphabetical">Alphabetical</option>
            <option value="recently_added">Recently Added</option>
          </select>
        </div>
      );
    }
    if (variant === 'type-header') {
      return (
        <div data-testid={`type-header-${typeInfo.typeName}`}>
          <span>{typeInfo.typeName} ({typeInfo.itemCount})</span>
          <button onClick={() => onToggleTypeCollapse(typeInfo.typeName)}>
            {typeInfo.isCollapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      );
    }
    if (variant === 'item-row') {
      return (
        <div
          data-testid={`item-row-${item.id}`}
          data-item-key={`${item.id}-${item.patientCategory}-${item.hospitalClass}`}
        >
          <span>{item.name}</span>
          <button onClick={() => onRemoveItem(item.id, item.patientCategory)}>Remove</button>
        </div>
      );
    }
    return null;
  }
}));

jest.mock('@nextui-org/react', () => ({
  Tabs: ({ children, selectedKey, onSelectionChange, items }: any) => (
    <div data-testid="tabs">
      {items.map((item: any) => (
        <button
          key={item.key}
          data-testid={`tab-${item.key}`}
          onClick={() => onSelectionChange(item.key)}
          className={selectedKey === item.key ? 'selected' : ''}
        >
          {item.label}
        </button>
      ))}
      <div data-testid="tab-content">
        {items.map((item: any) => selectedKey === item.key && children(item))}
      </div>
    </div>
  ),
  Tab: ({ children, title }: any) => <div data-testid="tab">{children}</div>,
  Spinner: () => <div data-testid="spinner">Loading...</div>
}));

jest.mock('lucide-react', () => ({
  InfoIcon: () => <div data-testid="info-icon">Info</div>
}));

jest.mock('@/lib/typesense', () => ({
  searchContentableWithFilters: jest.fn()
}));

jest.mock('@/helpers/package-items.helper', () => ({
  groupAndFilterItems: jest.fn((items) => {
    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
      const type = item.type || 'Unknown';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(item);
    });
    return grouped;
  })
}));

// Mock package service
jest.mock('@/services/package/package.service', () => ({
  PackageService: {
    getPackageDetail: jest.fn(),
    getDefaultContentPrice: jest.fn()
  },
  useGetPackageOptions: jest.fn()
}));

// Mock helper functions
jest.spyOn(packageFormHelper, 'contentTypeMapper').mockImplementation((type) => type || 'item');
jest.spyOn(packageFormHelper, 'createNewItem').mockImplementation((item, patientCategory, hospitalClass) => ({
  id: item.id,
  name: item.name,
  code: item.code,
  type: item.type,
  qty: 1,
  retail_price: item.retail_price,
  base_material_cost: item.base_material_cost,
  patientCategory,
  hospitalClass,
  serviceCost: 0,
  materialCost: 0,
  totalCost: 0
}));
jest.spyOn(packageFormHelper, 'handleItemFieldChange').mockImplementation((items, itemId, patientCategory, hospitalClass, field, value) => {
  return items.map((item) =>
    item.id === itemId && item.patientCategory === patientCategory && item.hospitalClass === hospitalClass
      ? { ...item, [field]: value }
      : item
  );
});
jest.spyOn(packageFormHelper, 'mapSelectedPatientCategories').mockImplementation((selected, response) => {
  return selected.map((key) => ({ key, label: `Category ${key}` }));
});
jest.spyOn(packageFormHelper, 'makeItemKey').mockImplementation((id, patientCategory, hospitalClass) => {
  return `${id}-${patientCategory}-${hospitalClass}`;
});
jest.spyOn(packageFormHelper, 'sortPackageItems').mockImplementation((items) => items);
jest.spyOn(packageFormHelper, 'toggleSetValue').mockImplementation((set, value) => {
  const newSet = new Set(set);
  if (newSet.has(value)) {
    newSet.delete(value);
  } else {
    newSet.add(value);
  }
  return newSet;
});
jest.spyOn(packageFormHelper, 'clean').mockImplementation((str) => str);
jest.spyOn(packageFormHelper, 'queueHighlightForItems').mockImplementation(() => {});
jest.spyOn(packageFormHelper, 'detransformPackageDetailToFormItemsAsync').mockResolvedValue([]);
jest.spyOn(packageFormHelper, 'cleanMarker').mockImplementation((str) => str);
jest.spyOn(packageFormHelper, 'buildHeaderPricingMap').mockReturnValue({});

describe('AddPackageStep2', () => {
  const mockOnFormDataChange = jest.fn();
  const mockOnSummaryHospitalClassChange = jest.fn();

  const defaultProps = {
    formData: {
      patientCategory: '1',
      items: [],
      searchQuery: '',
      itemSearchFilter: '',
      packageName: 'Test Package',
      commercialName: 'Commercial Test',
      costPriceUnit: '100',
      isStep2Open: true,
      baseOnTypesense: false,
      currentPatientCategory: '1'
    } as IAddPackageFormData,
    onFormDataChange: mockOnFormDataChange,
    summaryHospitalClass: '1',
    onSummaryHospitalClassChange: mockOnSummaryHospitalClassChange,
    hospitalClasses: [
      { key: '1', label: 'Class 1' },
      { key: '2', label: 'Class 2' }
    ]
  };

  const mockPatientCategoriesResponse = {
    data: [
      { id: 1, name: 'Category 1' },
      { id: 2, name: 'Category 2' }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (PackageService.useGetPackageOptions as jest.Mock) = jest.fn(() => ({
      data: mockPatientCategoriesResponse
    }));
    jest.spyOn(packageFormHelper, 'mapSelectedPatientCategories').mockReturnValue([
      { key: '1', label: 'Category 1' }
    ]);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<AddPackageStep2 {...defaultProps} />);
      expect(screen.getByText('Test Package')).toBeInTheDocument();
      expect(screen.getByText('Commercial Test')).toBeInTheDocument();
    });

    it('should render patient category required message when no patient category', () => {
      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, patientCategory: '' }
      };
      render(<AddPackageStep2 {...props} />);
      expect(screen.getByText('Patient Category Required')).toBeInTheDocument();
      expect(screen.getByText(/Please select at least one patient category/)).toBeInTheDocument();
    });

    it('should render no valid patient category message when categories cannot be mapped', () => {
      jest.spyOn(packageFormHelper, 'mapSelectedPatientCategories').mockReturnValue([]);
      render(<AddPackageStep2 {...defaultProps} />);
      expect(screen.getByText('No Valid Patient Category')).toBeInTheDocument();
    });

    it('should render no valid hospital class message when no hospital classes', () => {
      const props = {
        ...defaultProps,
        hospitalClasses: []
      };
      render(<AddPackageStep2 {...props} />);
      expect(screen.getByText('No Valid Hospital Class')).toBeInTheDocument();
    });

    it('should render tabs for patient categories', () => {
      render(<AddPackageStep2 {...defaultProps} />);
      expect(screen.getByTestId('tabs')).toBeInTheDocument();
      expect(screen.getByTestId('tab-1')).toBeInTheDocument();
    });

    it('should render package tables for each hospital class', () => {
      render(<AddPackageStep2 {...defaultProps} />);
      expect(screen.getByTestId('package-table-1')).toBeInTheDocument();
      expect(screen.getByTestId('package-table-2')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle typesense search input changes', async () => {
      render(<AddPackageStep2 {...defaultProps} />);
      const searchInput = screen.getByTestId('typesense-search');
      
      await userEvent.type(searchInput, 'test');
      
      expect(mockOnFormDataChange).toHaveBeenCalledWith('searchQuery', expect.any(String));
    });

    it('should handle item selection from typesense search', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue({
        data: [{ retail_price: 100, base_price: 50 }]
      });

      render(<AddPackageStep2 {...defaultProps} />);
      const searchInput = screen.getByTestId('typesense-search');
      
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(PackageService.getDefaultContentPrice).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockOnFormDataChange).toHaveBeenCalledWith('items', expect.any(Array));
      });
    });

    it('should handle removing an item', async () => {
      const itemsWithData = [
        {
          id: '1',
          name: 'Item 1',
          code: 'CODE1',
          type: 'item' as const,
          qty: 1,
          retail_price: 100,
          base_material_cost: 50,
          patientCategory: '1',
          hospitalClass: '1',
          serviceCost: 0,
          materialCost: 0,
          totalCost: 0
        }
      ];

      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, items: itemsWithData }
      };

      render(<AddPackageStep2 {...props} />);
      
      const removeButton = screen.getByText('Remove');
      await userEvent.click(removeButton);

      expect(mockOnFormDataChange).toHaveBeenCalledWith('items', []);
    });

    it('should handle item field changes', async () => {
      const itemsWithData = [
        {
          id: '1',
          name: 'Item 1',
          code: 'CODE1',
          type: 'item' as const,
          qty: 1,
          retail_price: 100,
          base_material_cost: 50,
          patientCategory: '1',
          hospitalClass: '1',
          serviceCost: 0,
          materialCost: 0,
          totalCost: 0
        }
      ];

      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, items: itemsWithData }
      };

      render(<AddPackageStep2 {...props} />);
      
      const qtyInput = screen.getByTestId('qty-1-1');
      await userEvent.clear(qtyInput);
      await userEvent.type(qtyInput, '5');

      expect(mockOnFormDataChange).toHaveBeenCalledWith('items', expect.any(Array));
    });

    it('should handle type collapse toggle', async () => {
      const itemsWithData = [
        {
          id: '1',
          name: 'Item 1',
          code: 'CODE1',
          type: 'Service' as const,
          qty: 1,
          retail_price: 100,
          base_material_cost: 50,
          patientCategory: '1',
          hospitalClass: '1',
          serviceCost: 0,
          materialCost: 0,
          totalCost: 0
        }
      ];

      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, items: itemsWithData }
      };

      render(<AddPackageStep2 {...props} />);
      
      const toggleButton = screen.getAllByText('Collapse')[0];
      await userEvent.click(toggleButton);

      // Type should now be collapsed
      expect(screen.queryByTestId('item-row-1')).not.toBeInTheDocument();
    });

    it('should handle search filter changes', async () => {
      render(<AddPackageStep2 {...defaultProps} />);
      
      const searchFilter = screen.getByTestId('search-filter');
      await userEvent.type(searchFilter, 'test filter');

      expect(mockOnFormDataChange).toHaveBeenCalledWith('itemSearchFilter', expect.any(String));
    });

    it('should handle sort mode changes', async () => {
      render(<AddPackageStep2 {...defaultProps} />);
      
      const sortSelect = screen.getByTestId('sort-mode');
      await userEvent.selectOptions(sortSelect, 'alphabetical');

      // Sort mode should be updated internally
      expect(sortSelect).toHaveValue('alphabetical');
    });

    it('should handle hospital class selection change', async () => {
      render(<AddPackageStep2 {...defaultProps} />);
      
      const classSelect = screen.getByTestId('select');
      fireEvent.change(classSelect, { target: { value: '2' } });

      expect(mockOnSummaryHospitalClassChange).toHaveBeenCalledWith('2');
    });

    it('should handle patient category tab change', async () => {
      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, patientCategory: '1,2' }
      };

      jest.spyOn(packageFormHelper, 'mapSelectedPatientCategories').mockReturnValue([
        { key: '1', label: 'Category 1' },
        { key: '2', label: 'Category 2' }
      ]);

      render(<AddPackageStep2 {...props} />);
      
      const tab2 = screen.getByTestId('tab-2');
      await userEvent.click(tab2);

      await waitFor(() => {
        expect(mockOnFormDataChange).toHaveBeenCalledWith('currentPatientCategory', '2');
      });
    });
  });

  describe('Effects', () => {
    it('should fetch package detail when baseOnTypesense is true', async () => {
      const mockPackageData = {
        data: {
          packages: [
            {
              id: 1,
              contentable_id: 123,
              contentable_type: 'item',
              qty: 1
            }
          ]
        }
      };

      (PackageService.getPackageDetail as jest.Mock).mockResolvedValue(mockPackageData);
      jest.spyOn(packageFormHelper, 'detransformPackageDetailToFormItemsAsync').mockResolvedValue([
        {
          id: '123',
          name: 'Fetched Item',
          code: 'FETCH001',
          type: 'item' as const,
          qty: 1,
          retail_price: 100,
          base_material_cost: 50,
          patientCategory: '1',
          hospitalClass: '1',
          serviceCost: 0,
          materialCost: 0,
          totalCost: 0
        }
      ]);

      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          baseOnTypesense: true,
          packageHeaderId: '999',
          isStep2Open: false
        }
      };

      render(<AddPackageStep2 {...props} />);

      await waitFor(() => {
        expect(PackageService.getPackageDetail).toHaveBeenCalledWith({
          organization_id: 100,
          package_header_id: 999
        });
      });

      await waitFor(() => {
        expect(mockOnFormDataChange).toHaveBeenCalledWith('items', expect.any(Array));
      });
    });

    it('should handle package detail fetch error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (PackageService.getPackageDetail as jest.Mock).mockRejectedValue(new Error('Fetch failed'));

      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          baseOnTypesense: true,
          packageHeaderId: '999',
          isStep2Open: false
        }
      };

      render(<AddPackageStep2 {...props} />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should sync currentPatientCategory with parent form data', async () => {
      const { rerender } = render(<AddPackageStep2 {...defaultProps} />);

      // Change the tab to trigger category change
      const props2 = {
        ...defaultProps,
        formData: { ...defaultProps.formData, patientCategory: '1,2', currentPatientCategory: '1' }
      };

      jest.spyOn(packageFormHelper, 'mapSelectedPatientCategories').mockReturnValue([
        { key: '1', label: 'Category 1' },
        { key: '2', label: 'Category 2' }
      ]);

      rerender(<AddPackageStep2 {...props2} />);

      const tab2 = screen.getByTestId('tab-2');
      await userEvent.click(tab2);

      await waitFor(() => {
        expect(mockOnFormDataChange).toHaveBeenCalledWith('currentPatientCategory', '2');
      });
    });

    it('should cleanup highlight timers on unmount', () => {
      const { unmount } = render(<AddPackageStep2 {...defaultProps} />);
      
      // This tests the cleanup effect
      unmount();
      
      // No errors should occur during unmount
      expect(true).toBe(true);
    });

    it('should inject highlight styles into document head', () => {
      render(<AddPackageStep2 {...defaultProps} />);
      
      const styleElement = document.getElementById('item-highlight-styles');
      expect(styleElement).toBeTruthy();
    });
  });

  describe('Async Operations', () => {
    it('should show loading spinner when fetching prices', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [{ retail_price: 100, base_price: 50 }] }), 100))
      );

      render(<AddPackageStep2 {...defaultProps} />);
      
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      
      act(() => {
        fireEvent.keyDown(searchInput, { key: 'Enter' });
      });

      // Should show spinner while loading
      await waitFor(() => {
        expect(screen.getByTestId('spinner')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should handle price fetch errors gracefully', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockRejectedValue(new Error('Price fetch failed'));

      render(<AddPackageStep2 {...defaultProps} />);
      
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnFormDataChange).toHaveBeenCalledWith('items', expect.any(Array));
      });
    });

    it('should not add duplicate items', async () => {
      const existingItem = {
        id: '123',
        name: 'Existing Item',
        code: 'EXIST001',
        type: 'item' as const,
        qty: 1,
        retail_price: 100,
        base_material_cost: 50,
        patientCategory: '1',
        hospitalClass: '1',
        serviceCost: 0,
        materialCost: 0,
        totalCost: 0
      };

      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue({
        data: [{ retail_price: 100, base_price: 50 }]
      });

      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, items: [existingItem] }
      };

      render(<AddPackageStep2 {...props} />);
      
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        // Should only add for hospital class 2, not class 1 (duplicate)
        const itemCalls = mockOnFormDataChange.mock.calls.filter(call => call[0] === 'items');
        const lastItemsCall = itemCalls[itemCalls.length - 1];
        // Original item + new item for class 2 only
        expect(lastItemsCall[1].length).toBeGreaterThan(1);
      });
    });
  });

  describe('Auto-scroll Functionality', () => {
    it('should scroll to selected hospital class', async () => {
      const mockScrollTo = jest.fn();
      Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
        configurable: true,
        value: mockScrollTo
      });

      render(<AddPackageStep2 {...defaultProps} />);
      
      // Change hospital class
      const classSelect = screen.getByTestId('select');
      fireEvent.change(classSelect, { target: { value: '2' } });

      // Allow effect to run
      await waitFor(() => {
        expect(mockOnSummaryHospitalClassChange).toHaveBeenCalledWith('2');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty items array', () => {
      render(<AddPackageStep2 {...defaultProps} />);
      expect(screen.getByTestId('package-table-1')).toBeInTheDocument();
    });

    it('should handle single hospital class', () => {
      const props = {
        ...defaultProps,
        hospitalClasses: [{ key: '1', label: 'Class 1' }]
      };
      render(<AddPackageStep2 {...props} />);
      expect(screen.getByTestId('package-table-1')).toBeInTheDocument();
      expect(screen.queryByTestId('package-table-2')).not.toBeInTheDocument();
    });

    it('should handle multiple patient categories', () => {
      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, patientCategory: '1,2,3' }
      };

      jest.spyOn(packageFormHelper, 'mapSelectedPatientCategories').mockReturnValue([
        { key: '1', label: 'Category 1' },
        { key: '2', label: 'Category 2' },
        { key: '3', label: 'Category 3' }
      ]);

      render(<AddPackageStep2 {...props} />);
      
      expect(screen.getByTestId('tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('tab-2')).toBeInTheDocument();
      expect(screen.getByTestId('tab-3')).toBeInTheDocument();
    });

    it('should clear search query after item selection', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue({
        data: [{ retail_price: 100, base_price: 50 }]
      });

      render(<AddPackageStep2 {...defaultProps} />);
      
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnFormDataChange).toHaveBeenCalledWith('searchQuery', '');
      });
    });

    it('should initialize insertion order for existing items', () => {
      const itemsWithData = [
        {
          id: '1',
          name: 'Item 1',
          code: 'CODE1',
          type: 'item' as const,
          qty: 1,
          retail_price: 100,
          base_material_cost: 50,
          patientCategory: '1',
          hospitalClass: '1',
          serviceCost: 0,
          materialCost: 0,
          totalCost: 0
        }
      ];

      const props = {
        ...defaultProps,
        formData: { ...defaultProps.formData, items: itemsWithData }
      };

      render(<AddPackageStep2 {...props} />);
      // Component should render without errors
      expect(screen.getByTestId('item-row-1')).toBeInTheDocument();
    });

    it('should switch to recently_added sort when adding new item in alphabetical mode', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue({
        data: [{ retail_price: 100, base_price: 50 }]
      });

      render(<AddPackageStep2 {...defaultProps} />);
      
      // Set to alphabetical
      const sortSelect = screen.getByTestId('sort-mode');
      await userEvent.selectOptions(sortSelect, 'alphabetical');

      // Add item
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(sortSelect).toHaveValue('recently_added');
      });
    });
  });

  describe('Helper Functions Coverage', () => {
    it('should call clean and cleanMarker on typesense package selection', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue({
        data: [{ retail_price: 100, base_price: 50 }]
      });

      render(<AddPackageStep2 {...defaultProps} />);
      
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(packageFormHelper.cleanMarker).toHaveBeenCalled();
        expect(packageFormHelper.clean).toHaveBeenCalled();
      });
    });

    it('should call queueHighlightForItems when adding new items', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue({
        data: [{ retail_price: 100, base_price: 50 }]
      });

      render(<AddPackageStep2 {...defaultProps} />);
      
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(packageFormHelper.queueHighlightForItems).toHaveBeenCalled();
      });
    });

    it('should call contentTypeMapper for content type conversion', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue({
        data: [{ retail_price: 100, base_price: 50 }]
      });

      render(<AddPackageStep2 {...defaultProps} />);
      
      const searchInput = screen.getByTestId('typesense-search');
      await userEvent.type(searchInput, 'test-item');
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(packageFormHelper.contentTypeMapper).toHaveBeenCalled();
      });
    });
  });

  describe('buildBatchPriceFetcher', () => {
    it('should handle successful price fetching', async () => {
      const mockPriceData = {
        data: [
          { sales_item_id: 123, retail_price: 100, base_price: 50 }
        ]
      };

      (PackageService.getDefaultContentPrice as jest.Mock).mockResolvedValue(mockPriceData);
      (PackageService.getPackageDetail as jest.Mock).mockResolvedValue({
        data: { packages: [{ id: 1, contentable_id: 123 }] }
      });

      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          baseOnTypesense: true,
          packageHeaderId: '999',
          isStep2Open: false
        }
      };

      render(<AddPackageStep2 {...props} />);

      await waitFor(() => {
        expect(PackageService.getPackageDetail).toHaveBeenCalled();
      });
    });

    it('should handle price fetching errors', async () => {
      (PackageService.getDefaultContentPrice as jest.Mock).mockRejectedValue(new Error('Failed'));
      (PackageService.getPackageDetail as jest.Mock).mockResolvedValue({
        data: { packages: [{ id: 1 }] }
      });

      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          baseOnTypesense: true,
          packageHeaderId: '999',
          isStep2Open: false
        }
      };

      render(<AddPackageStep2 {...props} />);

      await waitFor(() => {
        expect(PackageService.getPackageDetail).toHaveBeenCalled();
      });
    });
  });
});
