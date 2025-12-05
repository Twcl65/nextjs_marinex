'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, UserPlus } from 'lucide-react';

type UserServiceResult = {
  id: string;
  name: string;
  squareMeters: number | null;
  hours: number | null;
  workers: number | null;
  days: number | null;
  price: string | null;
};

const MIN_SERVICE_SEARCH_CHARS = 2;
const SERVICE_NAME_SUFFIX_LENGTH = 2;

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    role: 'shipowner',
    // common
    email: '',
    password: '',
    confirmPassword: '',
    contactNumber: '',
    // shipowner
    fullName: '',
    officeAddress: '',
    businessRegistrationNumber: '',
    vesselName: '',
    imoNumber: '',
    vesselType: '',
    vesselCapacity: '',
    // shipyard
    shipyardName: '',
    dockyardLocation: '',
    shipyardBusinessRegNumber: '',
    yearsOfOperation: '',
    maxVesselCapacity: '',
    dockingServices: [
      { name: '', squareMeters: '', hours: '', workers: '', days: '', price: '' },
    ] as { name: string; squareMeters: string; hours: string; workers: string; days: string; price: string }[],
    dryDockAvailability: '',
    certificateShipBuilder: undefined as File | undefined,
    certificateShipRepair: undefined as File | undefined,
    certificateOther: undefined as File | undefined,
    logoFile: undefined as File | undefined,
    contactPerson: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [apiError, setApiError] = useState<string>('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [serviceSearchResults, setServiceSearchResults] = useState<UserServiceResult[]>([]);
  const [isServiceSearchLoading, setIsServiceSearchLoading] = useState(false);
  const [serviceSearchError, setServiceSearchError] = useState('');
  const [availableTemplateServices, setAvailableTemplateServices] = useState<UserServiceResult[]>([]);
  const [isTemplateLoading, setIsTemplateLoading] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (formData.role !== 'shipyard') {
      setServiceSearchResults([]);
      setServiceSearchError('');
      setIsServiceSearchLoading(false);
      return;
    }

    const trimmedTerm = serviceSearchTerm.trim();

    if (trimmedTerm.length < MIN_SERVICE_SEARCH_CHARS) {
      setServiceSearchResults([]);
      setServiceSearchError('');
      setIsServiceSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsServiceSearchLoading(true);
      try {
        const response = await fetch(`/api/user-services?search=${encodeURIComponent(trimmedTerm)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch services');
        }

        const data = await response.json();
        setServiceSearchResults(data.services || []);
        setServiceSearchError('');
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        console.error('[Register] Service search failed:', error);
        setServiceSearchResults([]);
        setServiceSearchError('Unable to load saved services right now.');
      } finally {
        setIsServiceSearchLoading(false);
      }
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [serviceSearchTerm, formData.role]);

  useEffect(() => {
    if (formData.role !== 'shipyard') {
      setAvailableTemplateServices([]);
      setTemplateLoadError('');
      setIsTemplateLoading(false);
      return;
    }

    const fetchTemplates = async () => {
      setIsTemplateLoading(true);
      try {
        const response = await fetch('/api/user-services?mode=lookup');
        if (!response.ok) {
          throw new Error('Failed to load services');
        }
        const data = await response.json();
        setAvailableTemplateServices(data.services || []);
        setTemplateLoadError('');
      } catch (error) {
        console.error('[Register] Failed to load template services:', error);
        setAvailableTemplateServices([]);
        setTemplateLoadError('Unable to load existing services right now.');
      } finally {
        setIsTemplateLoading(false);
      }
    };

    fetchTemplates();
  }, [formData.role]);

  const isServiceSearchActive = serviceSearchTerm.trim().length >= MIN_SERVICE_SEARCH_CHARS;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error when user starts typing
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
  };

  const getNextServiceName = (baseName: string) => {
    const normalizedBase = baseName.trim();
    const regex = new RegExp(`^${normalizedBase}(?: (\d{${SERVICE_NAME_SUFFIX_LENGTH}}))?$`, 'i');
    let maxSuffix = 0;
    let hasExactMatch = false;

    formData.dockingServices.forEach((svc) => {
      const match = svc.name.match(regex);
      if (match) {
        if (match[1]) {
          const suffix = parseInt(match[1], 10);
          if (!Number.isNaN(suffix)) {
            maxSuffix = Math.max(maxSuffix, suffix);
          }
        } else {
          hasExactMatch = true;
        }
      }
    });

    if (!hasExactMatch && maxSuffix === 0) {
      return normalizedBase;
    }

    const nextSuffix = maxSuffix + 1;
    return `${normalizedBase} ${String(nextSuffix).padStart(SERVICE_NAME_SUFFIX_LENGTH, '0')}`;
  };

  const mapServiceResultToFormEntry = (service: UserServiceResult) => {
    const baseName = service.name || 'Service';
    const uniqueName = getNextServiceName(baseName);

    return {
      name: uniqueName,
      squareMeters: service.squareMeters?.toString() ?? '',
      hours: service.hours?.toString() ?? '',
      workers: service.workers?.toString() ?? '',
      days: service.days?.toString() ?? '',
      price: service.price || '',
    };
  };

  const handleAddServiceFromSearch = (service: UserServiceResult) => {
    setFormData((prev) => {
      const formattedService = mapServiceResultToFormEntry(service);

      const emptyIndex = prev.dockingServices.findIndex(
        (s) =>
          !s.name &&
          !s.squareMeters &&
          !s.hours &&
          !s.workers &&
          !s.days &&
          !s.price
      );

      const updatedServices =
        emptyIndex !== -1
          ? prev.dockingServices.map((svc, idx) => (idx === emptyIndex ? formattedService : svc))
          : [...prev.dockingServices, formattedService];

      return {
        ...prev,
        dockingServices: updatedServices,
      };
    });

    setErrors((prev) => {
      if (!prev.dockingServices) {
        return prev;
      }
      const nextErrors = { ...prev };
      delete nextErrors.dockingServices;
      return nextErrors;
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (formData.role === 'shipowner') {
      if (step === 1) {
        // Step 1: logo, company name, company number, company address, business registration num
        if (!formData.fullName.trim()) newErrors.fullName = 'Full/Company name is required';
        if (!formData.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
        if (!formData.officeAddress.trim()) newErrors.officeAddress = 'Office address is required';
      } else if (step === 2) {
        // Step 2: vessel infos
        const anyVesselProvided = [formData.vesselName, formData.imoNumber, formData.vesselType, formData.vesselCapacity].some(v => v && v.trim().length > 0);
        if (anyVesselProvided) {
          if (!formData.vesselName.trim()) newErrors.vesselName = 'Vessel name is required';
          if (!formData.imoNumber.trim()) newErrors.imoNumber = 'IMO/Vessel ID is required';
          if (!formData.vesselType.trim()) newErrors.vesselType = 'Vessel type is required';
          if (!formData.vesselCapacity.trim()) newErrors.vesselCapacity = 'Vessel capacity is required';
        }
      } else if (step === 3) {
        // Step 3: email, password, confirm password
        if (!formData.email.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          newErrors.email = 'Email is invalid';
        }
        if (!formData.password) {
          newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
          newErrors.password = 'Password must be at least 6 characters';
        }
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
      }
    } else if (formData.role === 'shipyard') {
      if (step === 1) {
        // Step 1: logo, company name, company number, company address, business registration num
        if (!formData.shipyardName.trim()) newErrors.shipyardName = 'Shipyard name is required';
        if (!formData.contactNumber.trim()) newErrors.contactNumber = 'Contact number is required';
        if (!formData.dockyardLocation.trim()) newErrors.dockyardLocation = 'Dockyard location is required';
        if (!formData.shipyardBusinessRegNumber.trim()) newErrors.shipyardBusinessRegNumber = 'Business registration number is required';
      } else if (step === 2) {
        // Step 2: vessel infos (docking services, etc.)
        const hasAnyServiceName = formData.dockingServices.some(s => s.name && s.name.trim().length > 0);
        if (!hasAnyServiceName) newErrors.dockingServices = 'Add at least one docking service';
        formData.dockingServices.forEach((s, idx) => {
          const prefix = `dockingServices[${idx}]`;
          if (s.name && s.name.trim().length > 0) {
            if (!s.squareMeters.trim()) newErrors[`${prefix}.squareMeters`] = 'Square meters required';
            if (!s.hours.trim()) newErrors[`${prefix}.hours`] = 'Hours required';
            if (!s.workers.trim()) newErrors[`${prefix}.workers`] = 'Workers required';
            if (!s.days.trim()) newErrors[`${prefix}.days`] = 'Days required';
            if (!s.price.trim()) newErrors[`${prefix}.price`] = 'Price required';
          }
        });
      } else if (step === 3) {
        // Step 3: email, password, confirm password
        if (!formData.email.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
          newErrors.email = 'Email is invalid';
        }
        if (!formData.password) {
          newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
          newErrors.password = 'Password must be at least 6 characters';
        }
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateForm = () => {
    return validateStep(3); // Final step validation
  };

  const handleContinue = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setUploadProgress(25);
    setApiError('');
    setSuccessMessage('');

    try {
      // Upload files to S3 first
      let logoUrl = '';
      let certificateBuilder = '';
      let certificateRepair = '';
      let certificateOther = '';

      // Upload logo if provided
      if (formData.logoFile) {
        console.log('[Register] Uploading logo to S3...');
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.logoFile);
        uploadFormData.append('prefix', 'logos');
        
        const uploadRes = await fetch('/api/uploads/upload', {
          method: 'POST',
          body: uploadFormData,
        });
        
        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          logoUrl = url;
          console.log('[Register] Logo uploaded successfully:', url);
        } else {
          const errorData = await uploadRes.json().catch(() => ({}));
          console.error('[Register] Logo upload failed:', uploadRes.status, errorData);
        }
      }

      // Upload certificates if provided (only for shipyard)
      if (formData.role === 'shipyard') {
        if (formData.certificateShipBuilder) {
          console.log('[Register] Uploading ship builder certificate...');
          const uploadFormData = new FormData();
          uploadFormData.append('file', formData.certificateShipBuilder);
          uploadFormData.append('prefix', 'certificates');
          
          const uploadRes = await fetch('/api/uploads/upload', {
            method: 'POST',
            body: uploadFormData,
          });
          
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            certificateBuilder = url;
            console.log('[Register] Ship builder certificate uploaded:', url);
          } else {
            console.error('[Register] Ship builder certificate upload failed:', uploadRes.status);
          }
        }

        if (formData.certificateShipRepair) {
          console.log('[Register] Uploading ship repair certificate...');
          const uploadFormData = new FormData();
          uploadFormData.append('file', formData.certificateShipRepair);
          uploadFormData.append('prefix', 'certificates');
          
          const uploadRes = await fetch('/api/uploads/upload', {
            method: 'POST',
            body: uploadFormData,
          });
          
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            certificateRepair = url;
            console.log('[Register] Ship repair certificate uploaded:', url);
          } else {
            console.error('[Register] Ship repair certificate upload failed:', uploadRes.status);
          }
        }

        if (formData.certificateOther) {
          console.log('[Register] Uploading other certificate...');
          const uploadFormData = new FormData();
          uploadFormData.append('file', formData.certificateOther);
          uploadFormData.append('prefix', 'certificates');
          
          const uploadRes = await fetch('/api/uploads/upload', {
            method: 'POST',
            body: uploadFormData,
          });
          
          if (uploadRes.ok) {
            const { url } = await uploadRes.json();
            certificateOther = url;
            console.log('[Register] Other certificate uploaded:', url);
          } else {
            console.error('[Register] Other certificate upload failed:', uploadRes.status);
          }
        }
      }

      // Update progress after file uploads
      setUploadProgress(50);

      // Prepare registration payload
      const payload: Record<string, unknown> = {
        email: formData.email,
        password: formData.password,
        role: formData.role === 'shipowner' ? 'SHIPOWNER' : 'SHIPYARD',
        contactNumber: formData.contactNumber || undefined,
        officeAddress: (formData.role === 'shipowner' ? formData.officeAddress : formData.dockyardLocation) || undefined,
        businessRegistrationNumber: (formData.role === 'shipowner' ? formData.businessRegistrationNumber : formData.shipyardBusinessRegNumber) || undefined,
        logoUrl: logoUrl || undefined,
        certificateBuilder: certificateBuilder || undefined,
        certificateRepair: certificateRepair || undefined,
        certificateOther: certificateOther || undefined,
      };

      if (formData.role === 'shipowner') {
        payload.fullName = formData.fullName || undefined;
        const anyVessel = [formData.vesselName, formData.imoNumber, formData.vesselType, formData.vesselCapacity].some(v => v && v.trim());
        if (anyVessel) {
          payload.vesselInfo = {
            vesselName: formData.vesselName,
            imoNumber: formData.imoNumber,
            vesselType: formData.vesselType,
            vesselCapacity: formData.vesselCapacity,
          };
        }
      } else {
        payload.shipyardName = formData.shipyardName || undefined;
        payload.officeAddress = formData.dockyardLocation || undefined;
        payload.businessRegistrationNumber = formData.shipyardBusinessRegNumber || undefined;
        payload.yearsOfOperation = formData.yearsOfOperation || undefined;
        payload.maxVesselCapacity = formData.maxVesselCapacity || undefined;
        payload.dockingServices = formData.dockingServices;
        payload.dryDockAvailability = formData.dryDockAvailability || undefined;
        payload.contactPerson = formData.contactPerson || undefined;
      }

      console.log('[Register] Sending registration payload:', payload);
      console.log('[Register] Certificate URLs being sent:', {
        certificateBuilder,
        certificateRepair,
        certificateOther
      });

      // Update progress before API call
      setUploadProgress(75);

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[Register] response status:', res.status);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[Register] error response text:', text);
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(text); } catch {}
        throw new Error((data?.error as string) || text || 'Failed to register');
      }
      const data = await res.json().catch(() => ({}));
      console.log('[Register] success response JSON:', data);

      // Update progress to 100%
      setUploadProgress(100);

      // Small delay to show 100% before closing loading dialog
      await new Promise(resolve => setTimeout(resolve, 300));

      // Optionally clear sensitive fields
      setFormData({
        ...formData,
        password: '',
        confirmPassword: '',
      });

      // Show approval dialog
      setIsLoading(false);
      setShowApprovalDialog(true);
    } catch (err: unknown) {
      setApiError((err instanceof Error ? err.message : 'Something went wrong'));
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/* Loading Dialog */}
      <Dialog open={isLoading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[350px] [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#134686] text-center">
              Creating Your Account
            </DialogTitle>
            <DialogDescription className="text-center pt-1 text-sm">
              Please wait while we process your registration...
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-full max-w-xs mb-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#134686] rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
            <p className="text-xs text-gray-500 text-center">
              {uploadProgress < 50 ? 'Uploading files...' : uploadProgress < 75 ? 'Processing data...' : uploadProgress < 100 ? 'Creating account...' : 'Almost done...'}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#134686]">
              Registration Submitted Successfully
            </DialogTitle>
            <DialogDescription className="text-base text-gray-700 pt-2">
              Thank you for registering with Marinex. Your account registration has been successfully submitted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Please wait for the Marine Industry Authority (MARINA) to review and approve your registration. 
              You will be notified via email once your account has been approved and activated.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-3">
              In the meantime, you can check the status of your registration by logging in with your credentials.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowApprovalDialog(false);
                router.push('/auth/login');
              }}
              className="w-full sm:w-auto bg-[#134686] hover:bg-[#0f3a6e] text-white"
            >
              Go to Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat py-10 px-4 sm:px-6 lg:px-8" style={{ backgroundImage: "url('/assets/background.jpg')" }}>
        <Card className="w-full max-w-3xl shadow-xl border-0 bg-white">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl sm:text-2xl font-bold text-[#134686]">
            Create your account
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-[#134686]/80">
            Sign up to get started with Marinex
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {apiError && (
              <div className="text-sm text-red-600">{apiError}</div>
            )}
            {successMessage && (
              <div className="text-sm text-green-700">{successMessage}</div>
            )}
            {/* Role Selector */}
            <div className="space-y-2">
              <Label className="text-[#134686] font-medium">Registering as</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={formData.role === 'shipowner' ? 'default' : 'secondary'}
                  className={`${formData.role === 'shipowner' ? 'bg-[#134686] hover:bg-[#0f3a6e] text-white' : ''}`}
                  onClick={() => {
                    setFormData({ ...formData, role: 'shipowner' });
                    setCurrentStep(1);
                  }}
                >
                  Shipowner
                </Button>
                <Button
                  type="button"
                  variant={formData.role === 'shipyard' ? 'default' : 'secondary'}
                  className={`${formData.role === 'shipyard' ? 'bg-[#134686] hover:bg-[#0f3a6e] text-white' : ''}`}
                  onClick={() => {
                    setFormData({ ...formData, role: 'shipyard' });
                    setCurrentStep(1);
                  }}
                >
                  Shipyard
                </Button>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center space-x-2 py-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep >= step
                        ? 'bg-[#134686] text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step}
                  </div>
                  {step < 3 && (
                    <div
                      className={`w-12 h-1 mx-1 ${currentStep > step ? 'bg-[#134686]' : 'bg-gray-200'}`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Company Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logoFile" className="text-[#134686] font-medium">Upload Logo</Label>
                  <Input id="logoFile" name="logoFile" type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files && e.target.files[0] ? e.target.files[0] : undefined;
                    setFormData({ ...formData, logoFile: file });
                  }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686]`}/>
                </div>

                {formData.role === 'shipowner' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-[#134686] font-medium">Company Name</Label>
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="e.g., John Doe Shipping Co."
                        value={formData.fullName}
                        onChange={handleChange}
                        className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.fullName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {errors.fullName && (<p className="text-sm text-red-600">{errors.fullName}</p>)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactNumber" className="text-[#134686] font-medium">Company Number</Label>
                      <Input id="contactNumber" name="contactNumber" type="tel" autoComplete="tel" placeholder="+63 900 000 0000" value={formData.contactNumber} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.contactNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                      {errors.contactNumber && (<p className="text-sm text-red-600">{errors.contactNumber}</p>)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="officeAddress" className="text-[#134686] font-medium">Company Address</Label>
                      <Input id="officeAddress" name="officeAddress" type="text" autoComplete="street-address" placeholder="City, Province, Country" value={formData.officeAddress} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.officeAddress ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                      {errors.officeAddress && (<p className="text-sm text-red-600">{errors.officeAddress}</p>)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessRegistrationNumber" className="text-[#134686] font-medium">Business Registration Number</Label>
                      <Input id="businessRegistrationNumber" name="businessRegistrationNumber" type="text" placeholder="BRN-XXXXX" value={formData.businessRegistrationNumber} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686]`}/>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="shipyardName" className="text-[#134686] font-medium">Company Name</Label>
                      <Input id="shipyardName" name="shipyardName" type="text" placeholder="e.g., Marinex Shipyards" value={formData.shipyardName} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.shipyardName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                      {errors.shipyardName && (<p className="text-sm text-red-600">{errors.shipyardName}</p>)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactNumber" className="text-[#134686] font-medium">Company Number</Label>
                      <Input id="contactNumber" name="contactNumber" type="tel" placeholder="+63 900 000 0000" value={formData.contactNumber} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.contactNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                      {errors.contactNumber && (<p className="text-sm text-red-600">{errors.contactNumber}</p>)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dockyardLocation" className="text-[#134686] font-medium">Company Address</Label>
                      <Input id="dockyardLocation" name="dockyardLocation" type="text" autoComplete="street-address" placeholder="City, Province, Country" value={formData.dockyardLocation} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.dockyardLocation ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                      {errors.dockyardLocation && (<p className="text-sm text-red-600">{errors.dockyardLocation}</p>)}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shipyardBusinessRegNumber" className="text-[#134686] font-medium">Business Registration Number</Label>
                      <Input id="shipyardBusinessRegNumber" name="shipyardBusinessRegNumber" type="text" placeholder="BRN-XXXXX" value={formData.shipyardBusinessRegNumber} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.shipyardBusinessRegNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                      {errors.shipyardBusinessRegNumber && (<p className="text-sm text-red-600">{errors.shipyardBusinessRegNumber}</p>)}
                    </div>
                  </>
                )}

                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="bg-[#134686] hover:bg-[#0f3a6e] text-white font-medium"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Vessel Information */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {formData.role === 'shipowner' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vesselName" className="text-[#134686]">Vessel Name</Label>
                        <Input id="vesselName" name="vesselName" type="text" placeholder="e.g., MV Marinex" value={formData.vesselName} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.vesselName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                        {errors.vesselName && (<p className="text-sm text-red-600">{errors.vesselName}</p>)}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="imoNumber" className="text-[#134686]">IMO Number / Vessel ID</Label>
                        <Input id="imoNumber" name="imoNumber" type="text" placeholder="e.g., IMO 1234567" value={formData.imoNumber} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.imoNumber ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                        {errors.imoNumber && (<p className="text-sm text-red-600">{errors.imoNumber}</p>)}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vesselType" className="text-[#134686]">Vessel Type</Label>
                        <Input id="vesselType" name="vesselType" type="text" placeholder="Tanker, Cargo, Passenger, etc." value={formData.vesselType} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.vesselType ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                        {errors.vesselType && (<p className="text-sm text-red-600">{errors.vesselType}</p>)}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vesselCapacity" className="text-[#134686]">Vessel Capacity (GT/DWT/passenger)</Label>
                        <Input id="vesselCapacity" name="vesselCapacity" type="text" placeholder="e.g., 50,000 DWT" value={formData.vesselCapacity} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.vesselCapacity ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                        {errors.vesselCapacity && (<p className="text-sm text-red-600">{errors.vesselCapacity}</p>)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[#134686] font-medium">Docking Services</Label>
                      {errors.dockingServices && (<p className="text-sm text-red-600">{errors.dockingServices}</p>)}
                    </div>
                    {formData.dockingServices.map((svc, idx) => (
                      <div key={idx} className="rounded-md border border-[#13468633] p-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`service-name-${idx}`} className="text-[#134686]">Service Name</Label>
                          <Input id={`service-name-${idx}`} type="text" placeholder="e.g., Floating Dock" value={svc.name} onChange={(e) => {
                            const ns = [...formData.dockingServices];
                            ns[idx] = { ...ns[idx], name: e.target.value };
                            setFormData({ ...formData, dockingServices: ns });
                            if (errors[`dockingServices[${idx}].name`]) setErrors({ ...errors, [`dockingServices[${idx}].name`]: '' });
                          }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686]`}/>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`service-sqm-${idx}`} className="text-[#134686]">How many square meters</Label>
                          <Input id={`service-sqm-${idx}`} type="number" min="0" placeholder="e.g., 200" value={svc.squareMeters} onChange={(e) => {
                            const ns = [...formData.dockingServices];
                            ns[idx] = { ...ns[idx], squareMeters: e.target.value };
                            setFormData({ ...formData, dockingServices: ns });
                            if (errors[`dockingServices[${idx}].squareMeters`]) setErrors({ ...errors, [`dockingServices[${idx}].squareMeters`]: '' });
                          }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors[`dockingServices[${idx}].squareMeters`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                          {errors[`dockingServices[${idx}].squareMeters`] && (<p className="text-sm text-red-600">{errors[`dockingServices[${idx}].squareMeters`]}</p>)}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`service-hours-${idx}`} className="text-[#134686]">How many hours</Label>
                          <Input id={`service-hours-${idx}`} type="number" min="0" placeholder="e.g., 8" value={svc.hours} onChange={(e) => {
                            const ns = [...formData.dockingServices];
                            ns[idx] = { ...ns[idx], hours: e.target.value };
                            setFormData({ ...formData, dockingServices: ns });
                            if (errors[`dockingServices[${idx}].hours`]) setErrors({ ...errors, [`dockingServices[${idx}].hours`]: '' });
                          }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors[`dockingServices[${idx}].hours`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                          {errors[`dockingServices[${idx}].hours`] && (<p className="text-sm text-red-600">{errors[`dockingServices[${idx}].hours`]}</p>)}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`service-workers-${idx}`} className="text-[#134686]">How many workers</Label>
                          <Input id={`service-workers-${idx}`} type="number" min="0" placeholder="e.g., 12" value={svc.workers} onChange={(e) => {
                            const ns = [...formData.dockingServices];
                            ns[idx] = { ...ns[idx], workers: e.target.value };
                            setFormData({ ...formData, dockingServices: ns });
                            if (errors[`dockingServices[${idx}].workers`]) setErrors({ ...errors, [`dockingServices[${idx}].workers`]: '' });
                          }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors[`dockingServices[${idx}].workers`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                          {errors[`dockingServices[${idx}].workers`] && (<p className="text-sm text-red-600">{errors[`dockingServices[${idx}].workers`]}</p>)}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`service-days-${idx}`} className="text-[#134686]">How many days</Label>
                          <Input id={`service-days-${idx}`} type="number" min="0" placeholder="e.g., 5" value={svc.days} onChange={(e) => {
                            const ns = [...formData.dockingServices];
                            ns[idx] = { ...ns[idx], days: e.target.value };
                            setFormData({ ...formData, dockingServices: ns });
                            if (errors[`dockingServices[${idx}].days`]) setErrors({ ...errors, [`dockingServices[${idx}].days`]: '' });
                          }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors[`dockingServices[${idx}].days`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                          {errors[`dockingServices[${idx}].days`] && (<p className="text-sm text-red-600">{errors[`dockingServices[${idx}].days`]}</p>)}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`service-price-${idx}`} className="text-[#134686]">Service Price</Label>
                          <Input id={`service-price-${idx}`} type="text" placeholder="e.g., ₱100,000" value={svc.price} onChange={(e) => {
                            const ns = [...formData.dockingServices];
                            ns[idx] = { ...ns[idx], price: e.target.value };
                            setFormData({ ...formData, dockingServices: ns });
                            if (errors[`dockingServices[${idx}].price`]) setErrors({ ...errors, [`dockingServices[${idx}].price`]: '' });
                          }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors[`dockingServices[${idx}].price`] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                          {errors[`dockingServices[${idx}].price`] && (<p className="text-sm text-red-600">{errors[`dockingServices[${idx}].price`]}</p>)}
                        </div>
                      </div>
                        <div className="flex items-center gap-2 justify-end">
                          {formData.dockingServices.length > 1 && (
                            <Button type="button" variant="secondary" onClick={() => {
                              const ns = formData.dockingServices.filter((_, i) => i !== idx);
                              setFormData({ ...formData, dockingServices: ns });
                            }}>Remove</Button>
                          )}
                          {idx === formData.dockingServices.length - 1 && (
                            <Button type="button" onClick={() => {
                              setFormData({
                                ...formData,
                                dockingServices: [...formData.dockingServices, { name: '', squareMeters: '', hours: '', workers: '', days: '', price: '' }]
                              })
                            }} className="bg-[#134686] hover:bg-[#0f3a6e] text-white">Add another service</Button>
                          )}
                        </div>
                      </div>
                    ))}
                  <div className="space-y-2">
                    <Label htmlFor="dryDockAvailability" className="text-[#134686] font-medium">Dry Dock Slots</Label>
                    <Input id="dryDockAvailability" name="dryDockAvailability" type="text" placeholder="e.g., 2 or more vessels" value={formData.dryDockAvailability} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.dryDockAvailability ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                    {errors.dryDockAvailability && (<p className="text-sm text-red-600">{errors.dryDockAvailability}</p>)}
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="certificateShipBuilder" className="text-[#134686]">Ship Builder Certificate</Label>
                        <Input id="certificateShipBuilder" name="certificateShipBuilder" type="file" onChange={(e) => {
                          const file = e.target.files && e.target.files[0] ? e.target.files[0] : undefined;
                          setFormData({ ...formData, certificateShipBuilder: file });
                          if (errors.certificateShipBuilder) setErrors({ ...errors, certificateShipBuilder: '' });
                        }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.certificateShipBuilder ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                        {errors.certificateShipBuilder && (<p className="text-sm text-red-600">{errors.certificateShipBuilder}</p>)}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="certificateShipRepair" className="text-[#134686]">Ship Repair Certificate</Label>
                        <Input id="certificateShipRepair" name="certificateShipRepair" type="file" onChange={(e) => {
                          const file = e.target.files && e.target.files[0] ? e.target.files[0] : undefined;
                          setFormData({ ...formData, certificateShipRepair: file });
                          if (errors.certificateShipRepair) setErrors({ ...errors, certificateShipRepair: '' });
                        }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.certificateShipRepair ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                        {errors.certificateShipRepair && (<p className="text-sm text-red-600">{errors.certificateShipRepair}</p>)}
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="certificateOther" className="text-[#134686]">Optional: ISO, Safety, Environmental Compliance</Label>
                        <Input id="certificateOther" name="certificateOther" type="file" onChange={(e) => {
                          const file = e.target.files && e.target.files[0] ? e.target.files[0] : undefined;
                          setFormData({ ...formData, certificateOther: file });
                        }} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686]`}/>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson" className="text-[#134686] font-medium">Contact Person (for coordination)</Label>
                    <Input id="contactPerson" name="contactPerson" type="text" placeholder="e.g., Jane Doe" value={formData.contactPerson} onChange={handleChange} className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.contactPerson ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}/>
                    {errors.contactPerson && (<p className="text-sm text-red-600">{errors.contactPerson}</p>)}
                  </div>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleBack}
                    className="text-[#134686]"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="bg-[#134686] hover:bg-[#0f3a6e] text-white font-medium"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Email and Password */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#134686] font-medium">
                    Company Email
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    required
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#134686] font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Create a password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    required
                  />
                  {errors.password && (
                    <p className="text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-[#134686] font-medium">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`border-[#13468633] focus:border-[#134686] focus:ring-[#134686] ${errors.confirmPassword ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                    required
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleBack}
                    className="text-[#134686]"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="bg-[#134686] hover:bg-[#0f3a6e] text-white font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      'Creating account...'
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Register
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-[#134686]">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-[#0f3a6e] hover:text-[#0c2f59] hover:underline"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
    </div>
  );
}