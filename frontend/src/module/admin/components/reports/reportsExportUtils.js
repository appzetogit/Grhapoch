// Export utility functions for reports
export const exportReportsToCSV = (data, headers, filename = "report") => {
  const rows = data.map((item, index) => {
    return headers.map(header => {
      const value = item[header.key] || item[header] || ""
      return typeof value === 'object' ? JSON.stringify(value) : value
    })
  })
  
  const headerRow = headers.map(h => typeof h === 'string' ? h : h.label).join(",")
  const csvContent = [
    headerRow,
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportReportsToExcel = (data, headers, filename = "report") => {
  const rows = data.map((item) => {
    return headers.map(header => {
      const value = item[header.key] || item[header] || ""
      return typeof value === 'object' ? JSON.stringify(value) : value
    })
  })
  
  const headerRow = headers.map(h => typeof h === 'string' ? h : h.label).join("\t")
  const csvContent = [
    headerRow,
    ...rows.map(row => row.join("\t"))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportReportsToPDF = (data, headers, filename = "report", title = "Report") => {
  const headerRow = headers.map(h => typeof h === 'string' ? h : h.label)
  const rightAlignColumns = headerRow.map(h => {
    const lower = h.toLowerCase()
    return lower.includes("amount") || 
           lower.includes("price") || 
           lower.includes("charge") || 
           lower.includes("vat") || 
           lower.includes("tax") || 
           lower.includes("total") || 
           lower.includes("discount") ||
           lower.includes("spent") ||
           lower.includes("points")
  })
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Inter', sans-serif; margin: 30px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; color: #1e293b; font-weight: 700; }
        .header p { margin: 0; font-size: 11px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 11px; }
        th { background-color: #3b82f6; color: #ffffff; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        tr:hover { background-color: #f1f5f9; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            ${headerRow.map((h, i) => `<th class="${rightAlignColumns[i] ? 'text-right' : ''}">${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${data.map(item => {
            const cells = headers.map((header, i) => {
              const value = item[header.key] || item[header] || ""
              return `<td class="${rightAlignColumns[i] ? 'text-right' : ''}">${String(value)}</td>`
            })
            return `<tr>${cells.join("")}</tr>`
          }).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `
  
  const printWindow = window.open("", "_blank")
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

export const exportReportsToJSON = (data, filename = "report") => {
  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Specific export functions for Transaction Report
export const exportTransactionReportToCSV = (transactions, filename = "transaction_report") => {
  const headers = ["SI", "Order ID", "Restaurant", "Customer Name", "Total Item Amount", "Item Discount", "Coupon Discount", "Referral Discount", "Discounted Amount", "VAT/Tax", "Delivery Charge", "Order Amount"]
  const rows = transactions.map((transaction, index) => [
    index + 1,
    transaction.orderId,
    transaction.restaurant,
    transaction.customerName,
    transaction.totalItemAmount.toFixed(2),
    transaction.itemDiscount.toFixed(2),
    transaction.couponDiscount.toFixed(2),
    transaction.referralDiscount.toFixed(2),
    transaction.discountedAmount.toFixed(2),
    transaction.vatTax.toFixed(2),
    transaction.deliveryCharge.toFixed(2),
    transaction.orderAmount.toFixed(2)
  ])
  
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportTransactionReportToExcel = (transactions, filename = "transaction_report") => {
  const headers = ["SI", "Order ID", "Restaurant", "Customer Name", "Total Item Amount", "Item Discount", "Coupon Discount", "Referral Discount", "Discounted Amount", "VAT/Tax", "Delivery Charge", "Order Amount"]
  const rows = transactions.map((transaction, index) => [
    index + 1,
    transaction.orderId,
    transaction.restaurant,
    transaction.customerName,
    transaction.totalItemAmount.toFixed(2),
    transaction.itemDiscount.toFixed(2),
    transaction.couponDiscount.toFixed(2),
    transaction.referralDiscount.toFixed(2),
    transaction.discountedAmount.toFixed(2),
    transaction.vatTax.toFixed(2),
    transaction.deliveryCharge.toFixed(2),
    transaction.orderAmount.toFixed(2)
  ])
  
  const csvContent = [
    headers.join("\t"),
    ...rows.map(row => row.join("\t"))
  ].join("\n")
  
  const blob = new Blob([csvContent], { type: "application/vnd.ms-excel" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.xls`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export const exportTransactionReportToPDF = (transactions, filename = "transaction_report") => {
  const headers = ["SI", "Order ID", "Restaurant", "Customer Name", "Total Item Amount", "Item Discount", "Coupon Discount", "Referral Discount", "Discounted Amount", "VAT/Tax", "Delivery Charge", "Order Amount"]
  
  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transaction Report</title>
      <style>
        body { font-family: 'Inter', sans-serif; margin: 30px; color: #333; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 22px; color: #1e293b; font-weight: 700; }
        .header p { margin: 0; font-size: 11px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 10px; }
        th { background-color: #3b82f6; color: #ffffff; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        tr:hover { background-color: #f1f5f9; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Transaction Report</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>SI</th>
            <th>Order ID</th>
            <th>Restaurant</th>
            <th>Customer Name</th>
            <th class="text-right">Total Item Amount</th>
            <th class="text-right">Item Discount</th>
            <th class="text-right">Coupon Discount</th>
            <th class="text-right">Referral Discount</th>
            <th class="text-right">Discounted Amount</th>
            <th class="text-right">VAT/Tax</th>
            <th class="text-right">Delivery Charge</th>
            <th class="text-right">Order Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map((transaction, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${transaction.orderId}</td>
              <td>${transaction.restaurant}</td>
              <td>${transaction.customerName}</td>
              <td class="text-right">Rs. ${transaction.totalItemAmount.toFixed(2)}</td>
              <td class="text-right">Rs. ${transaction.itemDiscount.toFixed(2)}</td>
              <td class="text-right">Rs. ${transaction.couponDiscount.toFixed(2)}</td>
              <td class="text-right">Rs. ${transaction.referralDiscount.toFixed(2)}</td>
              <td class="text-right">Rs. ${transaction.discountedAmount.toFixed(2)}</td>
              <td class="text-right">Rs. ${transaction.vatTax.toFixed(2)}</td>
              <td class="text-right">Rs. ${transaction.deliveryCharge.toFixed(2)}</td>
              <td class="text-right">Rs. ${transaction.orderAmount.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `
  
  const printWindow = window.open("", "_blank")
  printWindow.document.write(htmlContent)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}

export const exportTransactionReportToJSON = (transactions, filename = "transaction_report") => {
  const jsonContent = JSON.stringify(transactions, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.json`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

