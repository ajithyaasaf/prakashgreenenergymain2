import React, { useState, useEffect, useRef } from 'react';
import { Search, User, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  displayText: string;
}

interface CustomerAutocompleteProps {
  value: {
    name: string;
    mobile?: string;
    address?: string;
    email?: string;
  };
  onChange: (customer: {
    name: string;
    mobile: string;
    address: string;
    email?: string;
  }) => void;
  placeholder?: string;
  className?: string;
}

const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Start typing customer name...",
  className
}) => {
  const [query, setQuery] = useState(value.name || '');
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Search customers API call
  const searchCustomers = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchCustomers(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setShowSuggestions(true);
    setSelectedCustomer(null);
    
    // Update form data with manual input
    onChange({
      name: newValue,
      mobile: value.mobile || '',
      address: value.address || '',
      email: value.email || ''
    });
  };

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setQuery(customer.name);
    setSelectedCustomer(customer);
    setShowSuggestions(false);
    
    // Auto-fill all customer details
    onChange({
      name: customer.name,
      mobile: customer.phone || '',
      address: customer.address || '',
      email: customer.email || ''
    });
  };

  // Clear selection
  const handleClear = () => {
    setQuery('');
    setSelectedCustomer(null);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({
      name: '',
      mobile: '',
      address: '',
      email: ''
    });
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (value.name !== query) {
      setQuery(value.name || '');
    }
  }, [value.name]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-10 pr-10"
          onFocus={() => setShowSuggestions(true)}
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1 h-8 w-8 p-0"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (query.length >= 2 || suggestions.length > 0) && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Searching customers...
              </div>
            ) : suggestions.length > 0 ? (
              <div className="max-h-60 overflow-y-auto">
                {suggestions.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    <div className="flex-shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {customer.displayText}
                      </p>
                      {customer.address && (
                        <p className="text-xs text-muted-foreground truncate">
                          {customer.address}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No customers found. A new customer will be created.
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Selected customer indicator */}
      {selectedCustomer && (
        <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 rounded-md border border-green-200">
          <User className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-800">
            Customer details auto-filled from database
          </span>
        </div>
      )}
    </div>
  );
};

export default CustomerAutocomplete;