import { useState, useMemo } from "react"
import { exportToExcel, exportToPDF } from "./ordersExportUtils"

export function useGenericTableManagement(data, title, searchFields = []) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({})

  // Apply search
  const filteredData = useMemo(() => {
    let result = [...data]

    // Apply search query
    if (searchQuery.trim() && searchFields.length > 0) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(item => 
        searchFields.some(field => {
          const value = item[field]
          return value && value.toString().toLowerCase().includes(query)
        })
      )
    }

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== "") {
        result = result.filter(item => {
          // Special handling for known filter keys from FilterPanel
          if (key === 'fromDate') {
            const itemDate = item.orderDate || item.date || item.createdAt;
            if (!itemDate) return true;
            const from = new Date(value);
            const current = new Date(itemDate);
            return current >= from;
          }
          if (key === 'toDate') {
            const itemDate = item.orderDate || item.date || item.createdAt;
            if (!itemDate) return true;
            const to = new Date(value);
            to.setHours(23, 59, 59, 999);
            const current = new Date(itemDate);
            return current <= to;
          }
          if (key === 'minAmount') {
            const amount = item.totalAmount || item.amount || 0;
            return amount >= parseFloat(value);
          }
          if (key === 'maxAmount') {
            const amount = item.totalAmount || item.amount || 0;
            return amount <= parseFloat(value);
          }
          if (key === 'restaurant') {
            const restName = item.restaurantName || item.restaurant || "";
            return restName === value;
          }
          if (key === 'paymentStatus') {
             const payStatus = item.paymentStatus || item.payment?.status || "";
             if (value.toLowerCase() === "all") return true;
             return payStatus.toLowerCase() === value.toLowerCase();
          }

          // Default generic exact/case-insensitive match
          const itemValue = item[key]
          if (typeof value === 'string') {
            return itemValue === value || itemValue?.toString().toLowerCase() === value.toLowerCase()
          }
          return itemValue === value
        })
      }
    })

    return result
  }, [data, searchQuery, filters, searchFields])

  const count = filteredData.length

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "" && value !== null && value !== undefined).length
  }, [filters])

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({})
  }

  const handleExport = async (format) => {
    const filename = title.toLowerCase().replace(/\s+/g, "_")
    switch (format) {
      case "excel":
        exportToExcel(filteredData, filename)
        break
      case "pdf":
        await exportToPDF(filteredData, filename)
        break
      default:
        break
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setIsViewOrderOpen(true)
  }

  const handlePrintOrder = async (order) => {
    try {
      // Dynamic import of jsPDF and autoTable for instant PDF download
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Smart extraction for different order data structures
      const rawData = order.originalOrder || order;
      const orderId = order.orderId || rawData.orderId || rawData.id || rawData.subscriptionId || rawData._id || 'N/A';
      
      const dateStr = order.orderDate || order.date || (rawData.createdAt ? new Date(rawData.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'));
      const timeStr = order.orderTime || order.time || (rawData.createdAt ? new Date(rawData.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '');
      const fullDate = timeStr ? `${dateStr}, ${timeStr}` : dateStr;
      
      const customerName = order.customerName || order.userName || rawData.customerName || rawData.userId?.name || '';
      const customerPhone = order.customerPhone || order.userNumber || rawData.customerPhone || rawData.userId?.phone || '';
      const restaurantName = order.restaurantName || order.restaurant || rawData.restaurantId?.name || '';
      
      const itemsList = order.items || rawData.items || [];
      const totalAmt = order.totalAmount !== undefined ? order.totalAmount : (rawData.totalAmount || 0);
      const payStatus = order.paymentStatus || rawData.payment?.status || rawData.paymentStatus || '';
      const ordStatus = order.orderStatus || order.status || rawData.status || '';
      const devType = order.deliveryType || rawData.deliveryType || '';

      // Add title
      doc.setFontSize(18)
      doc.setTextColor(30, 30, 30)
      doc.text('Order Invoice', 105, 20, { align: 'center' })
      
      // Order ID
      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      doc.text(`Order ID: ${orderId}`, 105, 28, { align: 'center' })
      
      // Date
      doc.setFontSize(10)
      doc.text(`Date: ${fullDate}`, 105, 34, { align: 'center' })
      
      let startY = 45
      
      // Customer Information
      if (customerName || customerPhone) {
        doc.setFontSize(12)
        doc.setTextColor(30, 30, 30)
        doc.text('Customer Information', 14, startY)
        startY += 8
        
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        if (customerName) {
          doc.text(`Name: ${customerName}`, 14, startY)
          startY += 6
        }
        if (customerPhone) {
          doc.text(`Phone: ${customerPhone}`, 14, startY)
          startY += 6
        }
        startY += 5
      }
      
      // Restaurant Information
      if (restaurantName) {
        doc.setFontSize(12)
        doc.setTextColor(30, 30, 30)
        doc.text('Restaurant', 14, startY)
        startY += 8
        
        doc.setFontSize(10)
        doc.setTextColor(60, 60, 60)
        doc.text(restaurantName, 14, startY)
        startY += 10
      }
      
      // Delivery Type
      if (devType) {
        doc.setFontSize(10)
        doc.text(`Delivery Type: ${devType}`, 14, startY)
        startY += 8
      }

      // Order Items Table
      if (itemsList && Array.isArray(itemsList) && itemsList.length > 0) {
        const tableData = itemsList.map((item) => [
          item.quantity || 1,
          item.name || item.itemName || 'Unknown Item',
          `Rs. ${(item.price || 0).toFixed(2)}`,
          `Rs. ${((item.quantity || 1) * (item.price || 0)).toFixed(2)}`
        ])
        
        autoTable(doc, {
          startY: startY,
          head: [['Qty', 'Item Name', 'Price', 'Total']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [30, 30, 30]
          },
          alternateRowStyles: {
            fillColor: [245, 247, 250]
          },
          styles: {
            cellPadding: 4,
            lineColor: [200, 200, 200],
            lineWidth: 0.5
          },
          columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 80, halign: 'left' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
          },
          didParseCell: function (data) {
            if (data.column.index === 0) {
              data.cell.styles.halign = 'center';
            } else if (data.column.index === 2 || data.column.index === 3) {
              data.cell.styles.halign = 'right';
            }
          },
          margin: { left: 14, right: 14 }
        })
        
        startY = doc.lastAutoTable.finalY + 10
      }
      
      // Total Amount
      if (totalAmt !== undefined && totalAmt !== null) {
        doc.setFontSize(14)
        doc.setTextColor(30, 30, 30)
        doc.setFont(undefined, 'bold')
        const displayAmount = typeof totalAmt === 'number' ? totalAmt.toFixed(2) : totalAmt
        doc.text(`Total Amount: Rs. ${displayAmount}`, 14, startY)
        startY += 8
      }
      
      // Payment Status
      if (payStatus) {
        doc.setFontSize(10)
        doc.setTextColor(100, 100, 100)
        doc.setFont(undefined, 'normal')
        doc.text(`Payment Status: ${payStatus.toUpperCase()}`, 14, startY)
        startY += 6
      }
      
      // Order Status
      if (ordStatus) {
        doc.setFontSize(10)
        doc.text(`Order Status: ${ordStatus.toUpperCase()}`, 14, startY)
      }
      
      // Save the PDF instantly
      const filename = `Invoice_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(filename)
    } catch (error) {
      console.error("Error generating PDF invoice:", error)
      alert("Failed to download PDF invoice. Please try again.")
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const resetColumns = (defaultColumns) => {
    setVisibleColumns(defaultColumns || {})
  }

  return {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    filteredData,
    count,
    activeFiltersCount,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  }
}

