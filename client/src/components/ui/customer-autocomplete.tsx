import React, { useState, useEffect, useRef } from 'react';
import { Search, User, X } from 'lucide-react';
import { getAuth } from 'firebase/auth';
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
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.error('No authenticated user found');
        setSuggestions([]);
        return;
      }

      const token = await currentUser.getIdToken();
      const response = await fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        console.log('Found customers:', data.length);
      } else {
        console.error('Customer search failed:', response.status, response.statusText);
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search with immediate loading state
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Show loading immediately if query is long enough
    if (query.length >= 2) {
      setIsLoading(true);
    }

    debounceRef.current = setTimeout(() => {
      searchCustomers(query);
    }, 200); // Reduced from 300ms to 200ms for faster response

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
          placeholder={placeholder || "Type customer name or phone number..."}
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
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching customers...</span>
                </div>
                <p className="text-xs mt-1 text-blue-600">Please wait while we find existing customers</p>
              </div>
            ) : suggestions.length > 0 ? (
              <div>
                <div className="px-3 py-2 bg-green-50 border-b text-xs text-green-700 font-medium">
                  ✓ Found {suggestions.length} existing customer{suggestions.length > 1 ? 's' : ''} - Click to auto-fill details
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {suggestions.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      <div className="flex-shrink-0">
                        <User className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {customer.displayText}
                        </p>
                        {customer.address && (
                          <p className="text-xs text-muted-foreground truncate">
                            📍 {customer.address}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        Click to select
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : query.length >= 2 ? (
              <div className="p-3 text-center text-sm">
                <div className="text-amber-600 mb-1">⚠️ No existing customers found</div>
                <div className="text-muted-foreground text-xs">
                  Continue filling the form - a new customer will be created automatically
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Selected customer indicator */}
      {selectedCustomer && (
        <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 rounded-md border border-green-200">
          <User className="h-4 w-4 text-green-600" />
          <div className="flex-1">
            <div className="text-sm font-medium text-green-800">
              ✓ {selectedCustomer.name} selected from database
            </div>
            <div className="text-xs text-green-600">
              All customer details have been auto-filled below
            </div>
          </div>
        </div>
      )}

      {/* Helpful hint for new users */}
      {query.length >= 1 && query.length < 2 && !selectedCustomer && (
        <div className="mt-1 text-xs text-blue-600">
          💡 Keep typing to search existing customers (minimum 2 characters)
        </div>
      )}
    </div>
  );
};

export default CustomerAutocomplete;