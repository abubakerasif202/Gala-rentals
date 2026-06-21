const PUBLIC_FLEET_IMAGES = [
  '/car-images/ai-gala-navy-sedan-front.png',
  '/car-images/ai-gala-white-sedan-side.png',
  '/car-images/ai-gala-silver-sedan-profile.png',
  '/car-images/ai-gala-charcoal-sedan-rear.png',
  '/car-images/ai-gala-sedan-interior.png',
  '/car-images/ai-gala-navy-sedan-hero.png',
];

const isVehicleImageSource = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return Boolean(
    normalized &&
      (normalized.startsWith('/') ||
        normalized.startsWith('http://') ||
        normalized.startsWith('https://')),
  );
};

export const hasVehicleImage = (value: string | null | undefined) => isVehicleImageSource(value);

export const getPublicVehicleImage = (options: {
  id?: number | string | null;
  image?: string | null;
}) => {
  if (isVehicleImageSource(options.image)) {
    return options.image?.trim() as string;
  }

  const idNumber = Number(options.id);
  const imageIndex = Number.isFinite(idNumber) && idNumber > 0
    ? Math.abs(Math.trunc(idNumber)) % PUBLIC_FLEET_IMAGES.length
    : 0;

  return PUBLIC_FLEET_IMAGES[imageIndex];
};

export const featuredVehicleImages = PUBLIC_FLEET_IMAGES.slice(0, 6);
