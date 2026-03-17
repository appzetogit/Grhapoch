
import React from 'react';

/**
 * Global component to display Veg/Non-Veg icon
 * @param {Object} props
 * @param {boolean} props.isVeg - Boolean flag for veg
 * @param {string} props.foodType - String flag ("Veg" or "Non-Veg")
 * @param {string} props.className - Additional classes for the container
 * @param {string} props.size - Size preset ("sm", "md", "lg")
 */
const FoodTypeIcon = ({ isVeg, foodType, className = "", size = "md" }) => {
  // Normalize veg status
  const isVegFinal = isVeg !== undefined ? isVeg : (foodType === "Veg");
  
  const sizeClasses = {
    sm: {
      container: "h-3 w-3 rounded border-2",
      dot: "h-1.5 w-1.5"
    },
    md: {
      container: "h-4 w-4 rounded border-2",
      dot: "h-2 w-2"
    },
    lg: {
      container: "h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 rounded border-2",
      dot: "h-2.5 w-2.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5"
    }
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;
  
  const colorClasses = isVegFinal ? 
    "border-green-600 bg-white" : 
    "border-red-600 bg-white";
    
  const dotClasses = isVegFinal ? 
    "bg-green-600" : 
    "bg-red-600";

  return (
    <div className={`flex items-center justify-center flex-shrink-0 ${currentSize.container} ${colorClasses} ${className}`}>
      <div className={`${currentSize.dot} rounded-full ${dotClasses}`} />
    </div>
  );
};

export default FoodTypeIcon;
