/**
 * Marketing Department Site Visit Form
 * Handles marketing-specific project details and configurations
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  Zap, 
  Battery, 
  Droplets,
  Sun,
  Camera,
  MapPin,
  DollarSign,
  Waves
} from "lucide-react";
import { 
  marketingProjectTypes,
  solarPanelBrands,
  inverterMakes,
  inverterPhases,
  earthingTypes,
  panelWatts,
  inverterWatts,
  batteryBrands,
  waterHeaterBrands
} from "@shared/schema";

interface MarketingSiteVisitFormProps {
  onSubmit: (data: MarketingFormData) => void;
  onBack?: () => void;
  isDisabled?: boolean;
  isLoading?: boolean;
}

interface MarketingFormData {
  updateRequirements: boolean;
  projectType?: string;
  onGridConfig?: OnGridConfig;
  offGridConfig?: OffGridConfig;
  hybridConfig?: HybridConfig;
  waterHeaterConfig?: WaterHeaterConfig;
  waterPumpConfig?: WaterPumpConfig;
}

interface BaseConfig {
  projectValue: number;
  others?: string;
}

interface OnGridConfig extends BaseConfig {
  solarPanelMake: string;
  panelWatts: string;
  inverterMake: string;
  inverterWatts: string;
  inverterPhase: string;
  lightningArrest: boolean;
  earth: string;
  floor?: string;
  panelCount: number;
  structureHeight: number;
}

interface OffGridConfig extends OnGridConfig {
  batteryBrand: string;
  voltage: number;
  batteryCount: number;
  batteryStands?: string;
}

interface HybridConfig extends OffGridConfig {}

interface WaterHeaterConfig extends BaseConfig {
  brand: string;
  litre: number;
  heatingCoil?: string;
}

interface WaterPumpConfig extends BaseConfig {
  hp: string;
  drive: string;
  solarPanel?: string;
  structureHeight: number;
  panelBrand: string;
  panelCount: number;
}

// Project type options with descriptions
const projectTypeOptions = [
  { value: 'on_grid', label: 'On-Grid Solar System', icon: Sun, description: 'Grid-tied solar power system' },
  { value: 'off_grid', label: 'Off-Grid Solar System', icon: Battery, description: 'Standalone solar system with battery storage' },
  { value: 'hybrid', label: 'Hybrid Solar System', icon: Zap, description: 'Grid-tied with battery backup' },
  { value: 'water_heater', label: 'Solar Water Heater', icon: Droplets, description: 'Solar water heating system' },
  { value: 'water_pump', label: 'Solar Water Pump', icon: Droplets, description: 'Solar-powered water pumping system' }
];

export function MarketingSiteVisitForm({ onSubmit, onBack, isDisabled, isLoading }: MarketingSiteVisitFormProps) {
  const [formData, setFormData] = useState<MarketingFormData>({
    updateRequirements: false
  });

  const handleRequirementsUpdate = (value: string) => {
    const shouldUpdate = value === 'yes';
    setFormData(prev => ({
      ...prev,
      updateRequirements: shouldUpdate,
      projectType: shouldUpdate ? '' : undefined,
      onGridConfig: undefined,
      offGridConfig: undefined,
      hybridConfig: undefined,
      waterHeaterConfig: undefined,
      waterPumpConfig: undefined
    }));
  };

  const handleProjectTypeChange = (projectType: string) => {
    setFormData(prev => ({
      ...prev,
      projectType,
      onGridConfig: projectType === 'on_grid' ? {
        solarPanelMake: '',
        panelWatts: '530',
        inverterMake: '',
        inverterWatts: '',
        inverterPhase: '',
        lightningArrest: false,
        earth: 'ac',
        floor: '',
        panelCount: 1,
        structureHeight: 0,
        projectValue: 0,
        others: ''
      } : undefined,
      offGridConfig: projectType === 'off_grid' ? {
        solarPanelMake: '',
        panelWatts: '530',
        inverterMake: '',
        inverterWatts: '',
        inverterPhase: '',
        lightningArrest: false,
        earth: 'ac',
        floor: '',
        panelCount: 1,
        structureHeight: 0,
        batteryBrand: '',
        voltage: 12,
        batteryCount: 1,
        batteryStands: '',
        projectValue: 0,
        others: ''
      } : undefined,
      hybridConfig: projectType === 'hybrid' ? {
        solarPanelMake: '',
        panelWatts: '530',
        inverterMake: '',
        inverterWatts: '',
        inverterPhase: '',
        lightningArrest: false,
        earth: 'ac',
        floor: '',
        panelCount: 1,
        structureHeight: 0,
        batteryBrand: '',
        voltage: 12,
        batteryCount: 1,
        batteryStands: '',
        projectValue: 0,
        others: ''
      } : undefined,
      waterHeaterConfig: projectType === 'water_heater' ? {
        brand: '',
        litre: 100,
        heatingCoil: '',
        projectValue: 0,
        others: ''
      } : undefined,
      waterPumpConfig: projectType === 'water_pump' ? {
        hp: '',
        drive: '',
        solarPanel: '',
        structureHeight: 0,
        panelBrand: '',
        panelCount: 1,
        projectValue: 0,
        others: ''
      } : undefined
    }));
  };

  const updateConfig = (configType: keyof MarketingFormData, updates: any) => {
    setFormData(prev => {
      const currentConfig = prev[configType];
      return {
        ...prev,
        [configType]: currentConfig && typeof currentConfig === 'object' 
          ? { ...currentConfig, ...updates } 
          : updates
      };
    });
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const isFormValid = !formData.updateRequirements || 
    (formData.projectType && 
     ((formData.projectType === 'on_grid' && formData.onGridConfig?.solarPanelMake && formData.onGridConfig?.inverterMake && formData.onGridConfig?.panelCount > 0) ||
      (formData.projectType === 'off_grid' && formData.offGridConfig?.solarPanelMake && formData.offGridConfig?.inverterMake && formData.offGridConfig?.batteryBrand && formData.offGridConfig?.panelCount > 0) ||
      (formData.projectType === 'hybrid' && formData.hybridConfig?.solarPanelMake && formData.hybridConfig?.inverterMake && formData.hybridConfig?.batteryBrand && formData.hybridConfig?.panelCount > 0) ||
      (formData.projectType === 'water_heater' && formData.waterHeaterConfig?.brand && formData.waterHeaterConfig?.litre > 0) ||
      (formData.projectType === 'water_pump' && formData.waterPumpConfig?.hp && formData.waterPumpConfig?.panelBrand && formData.waterPumpConfig?.panelCount > 0)));

  return (
    <div className="space-y-6">
      {/* Customer Requirements Update */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Customer Requirements Update
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Would you like to update customer requirements during this visit?
            </p>
            <RadioGroup 
              value={formData.updateRequirements ? 'yes' : 'no'} 
              onValueChange={handleRequirementsUpdate}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="yes" />
                <Label htmlFor="yes">Yes - Update project requirements</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="no" />
                <Label htmlFor="no">No - Site visit only</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Project Details (only if updating requirements) */}
      {formData.updateRequirements && (
        <>
          {/* Project Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Project Type Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectTypeOptions.map((project) => {
                  const Icon = project.icon;
                  return (
                    <Card
                      key={project.value}
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        formData.projectType === project.value ? 'ring-2 ring-primary bg-accent' : ''
                      }`}
                      onClick={() => handleProjectTypeChange(project.value)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Icon className="h-6 w-6 mt-1" />
                          <div>
                            <h4 className="font-medium">{project.label}</h4>
                            <p className="text-sm text-muted-foreground">
                              {project.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* ON-GRID Configuration */}
          {formData.projectType === 'on_grid' && formData.onGridConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-5 w-5" />
                  On-Grid Solar System Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Solar Panel Make *</Label>
                    <Select 
                      value={formData.onGridConfig.solarPanelMake}
                      onValueChange={(value) => updateConfig('onGridConfig', { solarPanelMake: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select panel brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {solarPanelBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Panel Watts</Label>
                    <Select 
                      value={formData.onGridConfig.panelWatts}
                      onValueChange={(value) => updateConfig('onGridConfig', { panelWatts: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {panelWatts.map((watts) => (
                          <SelectItem key={watts} value={watts}>
                            {watts}W
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Inverter Make *</Label>
                    <Select 
                      value={formData.onGridConfig.inverterMake}
                      onValueChange={(value) => updateConfig('onGridConfig', { inverterMake: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select inverter brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterMakes.map((make) => (
                          <SelectItem key={make} value={make}>
                            {make.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Inverter Watts</Label>
                    <Select 
                      value={formData.onGridConfig.inverterWatts}
                      onValueChange={(value) => updateConfig('onGridConfig', { inverterWatts: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select inverter capacity" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterWatts.map((watts) => (
                          <SelectItem key={watts} value={watts}>
                            {watts}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Inverter Phase</Label>
                    <Select 
                      value={formData.onGridConfig.inverterPhase}
                      onValueChange={(value) => updateConfig('onGridConfig', { inverterPhase: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select phase" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_phase">Single Phase</SelectItem>
                        <SelectItem value="three_phase">Three Phase</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Earth Connection</Label>
                    <Select 
                      value={formData.onGridConfig.earth}
                      onValueChange={(value) => updateConfig('onGridConfig', { earth: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select earth type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dc">DC</SelectItem>
                        <SelectItem value="ac">AC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Panel Count</Label>
                    <Input
                      type="number"
                      value={formData.onGridConfig.panelCount}
                      onChange={(e) => updateConfig('onGridConfig', { panelCount: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label>Structure Height (ft)</Label>
                    <Input
                      type="number"
                      value={formData.onGridConfig.structureHeight}
                      onChange={(e) => updateConfig('onGridConfig', { structureHeight: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>

                  <div>
                    <Label>Floor Details</Label>
                    <Input
                      value={formData.onGridConfig.floor || ''}
                      onChange={(e) => updateConfig('onGridConfig', { floor: e.target.value })}
                      placeholder="Ground floor, First floor, etc."
                    />
                  </div>

                  <div>
                    <Label>Project Value (₹)</Label>
                    <Input
                      type="number"
                      value={formData.onGridConfig.projectValue}
                      onChange={(e) => updateConfig('onGridConfig', { projectValue: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="lightningArrest"
                    checked={formData.onGridConfig.lightningArrest}
                    onCheckedChange={(checked) => updateConfig('onGridConfig', { lightningArrest: checked })}
                  />
                  <Label htmlFor="lightningArrest">Lightning Arrestor Required</Label>
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={formData.onGridConfig.others || ''}
                    onChange={(e) => updateConfig('onGridConfig', { others: e.target.value })}
                    placeholder="Any additional specifications or notes..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* OFF-GRID Configuration */}
          {formData.projectType === 'off_grid' && formData.offGridConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Battery className="h-5 w-5" />
                  Off-Grid Solar System Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Solar Panel Make *</Label>
                    <Select 
                      value={formData.offGridConfig.solarPanelMake}
                      onValueChange={(value) => updateConfig('offGridConfig', { solarPanelMake: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select panel brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {solarPanelBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Panel Watts</Label>
                    <Select 
                      value={formData.offGridConfig.panelWatts}
                      onValueChange={(value) => updateConfig('offGridConfig', { panelWatts: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {panelWatts.map((watts) => (
                          <SelectItem key={watts} value={watts}>
                            {watts}W
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Inverter Make *</Label>
                    <Select 
                      value={formData.offGridConfig.inverterMake}
                      onValueChange={(value) => updateConfig('offGridConfig', { inverterMake: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select inverter brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterMakes.map((make) => (
                          <SelectItem key={make} value={make}>
                            {make.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Battery Brand *</Label>
                    <Select 
                      value={formData.offGridConfig.batteryBrand}
                      onValueChange={(value) => updateConfig('offGridConfig', { batteryBrand: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select battery brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {batteryBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Panel Count *</Label>
                    <Input
                      type="number"
                      value={formData.offGridConfig.panelCount}
                      onChange={(e) => updateConfig('offGridConfig', { panelCount: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label>Battery Count</Label>
                    <Input
                      type="number"
                      value={formData.offGridConfig.batteryCount}
                      onChange={(e) => updateConfig('offGridConfig', { batteryCount: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label>Battery Voltage</Label>
                    <Input
                      type="number"
                      value={formData.offGridConfig.voltage}
                      onChange={(e) => updateConfig('offGridConfig', { voltage: parseInt(e.target.value) || 12 })}
                      placeholder="12V, 24V, 48V etc"
                    />
                  </div>

                  <div>
                    <Label>Project Value (₹)</Label>
                    <Input
                      type="number"
                      value={formData.offGridConfig.projectValue}
                      onChange={(e) => updateConfig('offGridConfig', { projectValue: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={formData.offGridConfig.others || ''}
                    onChange={(e) => updateConfig('offGridConfig', { others: e.target.value })}
                    placeholder="Any additional specifications or notes..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* HYBRID Configuration */}
          {formData.projectType === 'hybrid' && formData.hybridConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Hybrid Solar System Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Solar Panel Make *</Label>
                    <Select 
                      value={formData.hybridConfig.solarPanelMake}
                      onValueChange={(value) => updateConfig('hybridConfig', { solarPanelMake: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select panel brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {solarPanelBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Inverter Make *</Label>
                    <Select 
                      value={formData.hybridConfig.inverterMake}
                      onValueChange={(value) => updateConfig('hybridConfig', { inverterMake: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select inverter brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {inverterMakes.map((make) => (
                          <SelectItem key={make} value={make}>
                            {make.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Battery Brand *</Label>
                    <Select 
                      value={formData.hybridConfig.batteryBrand}
                      onValueChange={(value) => updateConfig('hybridConfig', { batteryBrand: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select battery brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {batteryBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Panel Count *</Label>
                    <Input
                      type="number"
                      value={formData.hybridConfig.panelCount}
                      onChange={(e) => updateConfig('hybridConfig', { panelCount: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label>Project Value (₹)</Label>
                    <Input
                      type="number"
                      value={formData.hybridConfig.projectValue}
                      onChange={(e) => updateConfig('hybridConfig', { projectValue: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={formData.hybridConfig.others || ''}
                    onChange={(e) => updateConfig('hybridConfig', { others: e.target.value })}
                    placeholder="Any additional specifications or notes..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* WATER HEATER Configuration */}
          {formData.projectType === 'water_heater' && formData.waterHeaterConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5" />
                  Solar Water Heater Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Water Heater Brand *</Label>
                    <Select 
                      value={formData.waterHeaterConfig.brand}
                      onValueChange={(value) => updateConfig('waterHeaterConfig', { brand: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select water heater brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {waterHeaterBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Capacity (Litre) *</Label>
                    <Input
                      type="number"
                      value={formData.waterHeaterConfig.litre}
                      onChange={(e) => updateConfig('waterHeaterConfig', { litre: parseInt(e.target.value) || 100 })}
                      min="50"
                      placeholder="100, 150, 200, 300..."
                    />
                  </div>

                  <div>
                    <Label>Heating Coil Type</Label>
                    <Input
                      value={formData.waterHeaterConfig.heatingCoil || ''}
                      onChange={(e) => updateConfig('waterHeaterConfig', { heatingCoil: e.target.value })}
                      placeholder="Standard, Premium, etc."
                    />
                  </div>

                  <div>
                    <Label>Project Value (₹)</Label>
                    <Input
                      type="number"
                      value={formData.waterHeaterConfig.projectValue}
                      onChange={(e) => updateConfig('waterHeaterConfig', { projectValue: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={formData.waterHeaterConfig.others || ''}
                    onChange={(e) => updateConfig('waterHeaterConfig', { others: e.target.value })}
                    placeholder="Any additional specifications or notes..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* WATER PUMP Configuration */}
          {formData.projectType === 'water_pump' && formData.waterPumpConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5" />
                  Solar Water Pump Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Motor HP *</Label>
                    <Select 
                      value={formData.waterPumpConfig.hp}
                      onValueChange={(value) => updateConfig('waterPumpConfig', { hp: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select motor horsepower" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.5">0.5 HP</SelectItem>
                        <SelectItem value="1">1 HP</SelectItem>
                        <SelectItem value="2">2 HP</SelectItem>
                        <SelectItem value="3">3 HP</SelectItem>
                        <SelectItem value="5">5 HP</SelectItem>
                        <SelectItem value="7.5">7.5 HP</SelectItem>
                        <SelectItem value="10">10 HP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Drive Type</Label>
                    <Select 
                      value={formData.waterPumpConfig.drive}
                      onValueChange={(value) => updateConfig('waterPumpConfig', { drive: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select drive type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vfd">VFD (Variable Frequency Drive)</SelectItem>
                        <SelectItem value="direct">Direct Drive</SelectItem>
                        <SelectItem value="submersible">Submersible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Panel Brand *</Label>
                    <Select 
                      value={formData.waterPumpConfig.panelBrand}
                      onValueChange={(value) => updateConfig('waterPumpConfig', { panelBrand: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select panel brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {solarPanelBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand.replace('_', ' ').toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Panel Count *</Label>
                    <Input
                      type="number"
                      value={formData.waterPumpConfig.panelCount}
                      onChange={(e) => updateConfig('waterPumpConfig', { panelCount: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label>Structure Height (ft)</Label>
                    <Input
                      type="number"
                      value={formData.waterPumpConfig.structureHeight}
                      onChange={(e) => updateConfig('waterPumpConfig', { structureHeight: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>

                  <div>
                    <Label>Project Value (₹)</Label>
                    <Input
                      type="number"
                      value={formData.waterPumpConfig.projectValue}
                      onChange={(e) => updateConfig('waterPumpConfig', { projectValue: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={formData.waterPumpConfig.others || ''}
                    onChange={(e) => updateConfig('waterPumpConfig', { others: e.target.value })}
                    placeholder="Any additional specifications or notes..."
                  />
                </div>
              </CardContent>
            </Card>
          )}

        </>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            Back to Customer Details
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || isDisabled || isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              Continue to Site Photos
            </>
          )}
        </Button>
      </div>
    </div>
  );
}