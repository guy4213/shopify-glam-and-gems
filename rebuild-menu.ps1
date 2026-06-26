$token   = $env:SHOPIFY_ADMIN_TOKEN
$store   = "glam-and-gems-2.myshopify.com"
$menuGID = "gid://shopify/Menu/245604024510"
$headers = @{ "X-Shopify-Access-Token" = $token; "Content-Type" = "application/json" }

function i([string]$t, [string]$u = "/", [array]$c = @()) {
    if ($u -eq "/") { return @{ title = $t; type = "FRONTPAGE"; items = $c } }
    return @{ title = $t; type = "HTTP"; url = $u; items = $c }
}

$menuItems = @(
  (i "Home"),

  (i "Engagement Rings" "/collections/engagement-rings" @(
    (i "Shop by Shape" "/" @(
      (i "Oval"              "/collections/oval-engagement-rings"),
      (i "Pear"              "/collections/pear-engagement-rings"),
      (i "Round"             "/collections/round-engagement-rings"),
      (i "Radiant"           "/collections/radiant-engagement-rings"),
      (i "Emerald"           "/collections/emerald-engagement-rings"),
      (i "Marquise"          "/collections/marquise-engagement-rings"),
      (i "Cushion"           "/collections/cushion-engagement-rings"),
      (i "Elongated Cushion" "/collections/elongated-cushion-engagement-rings"),
      (i "Princess"          "/collections/princess-engagement-rings"),
      (i "Asscher"           "/collections/asscher-engagement-rings"),
      (i "Heart"             "/collections/heart-engagement-rings")
    )),
    (i "Shop by Style" "/" @(
      (i "Solitaire"   "/collections/solitaire-engagement-rings"),
      (i "Three Stone" "/collections/three-stone-engagement-rings"),
      (i "Side Stones" "/collections/side-diamonds-engagement-rings"),
      (i "Hidden Halo" "/collections/hidden-halo-engagement-rings"),
      (i "Halo"        "/collections/halo-engagement-rings"),
      (i "Double Halo" "/collections/double-halo-engagement-rings"),
      (i "Bridal Sets" "/collections/bridal-set-engagement-rings")
    )),
    (i "Favorites" "/" @(
      (i "Best Sellers"                "/collections/best-sellers"),
      (i "New Arrivals"                "/collections/new-arrivals"),
      (i "Customize Your Ring"         "/pages/customize"),
      (i "Book a Private Consultation" "/pages/consultation"),
      (i "Find my Ring Size"           "/pages/ring-size"),
      (i "Buyers Guide"                "/pages/buyers-guide"),
      (i "Diamond Carat Guide"         "/pages/carat-guide"),
      (i "Engagement Ring Styles"      "/pages/ring-styles"),
      (i "Lab Grown Diamonds"          "/pages/lab-grown-diamonds"),
      (i "Diamond Shape Guide"         "/pages/diamond-shape-guide"),
      (i "Metal Type Guide"            "/pages/metal-type-guide")
    ))
  )),

  (i "Wedding Rings" "/collections/wedding-rings" @(
    (i "Women" "/" @(
      (i "Classic Bands"   "/collections/classic-bands"),
      (i "Side Diamonds"   "/collections/side-diamond-wedding-rings"),
      (i "Bezel"           "/collections/bezel-wedding-rings"),
      (i "Eternity"        "/collections/eternity-rings"),
      (i "Half Eternity"   "/collections/half-eternity-rings"),
      (i "Contoured Rings" "/collections/contoured-rings"),
      (i "Special"         "/collections/special-wedding-rings"),
      (i "Bridal Set"      "/collections/bridal-set-engagement-rings")
    )),
    (i "Men" "/" @(
      (i "Classic Bands"      "/collections/classic-bands"),
      (i "Diamonds Bands"     "/collections/diamond-bands"),
      (i "Mens Jewelry"       "/collections/mens-jewelry"),
      (i "Customize Your Own" "/pages/customize")
    )),
    (i "Favorites" "/" @(
      (i "Best Sellers"                          "/collections/best-sellers"),
      (i "New Arrivals"                          "/collections/new-arrivals"),
      (i "Customize Your Ring"                   "/pages/customize"),
      (i "Book a Private Consultation"           "/pages/consultation"),
      (i "Find my Ring Size"                     "/pages/ring-size"),
      (i "Wedding Rings Guide"                   "/pages/wedding-rings-guide"),
      (i "Metal Type Guide"                      "/pages/metal-type-guide"),
      (i "How to Match the Perfect Wedding Band" "/pages/match-wedding-band"),
      (i "Engraving Inspiration"                 "/pages/engraving"),
      (i "Lab Grown Diamonds"                    "/pages/lab-grown-diamonds")
    ))
  )),

  (i "Ready To Ship" "/collections/ready-to-ship" @(
    (i "Shop by Category" "/" @(
      (i "Engagement Rings" "/collections/engagement-rings"),
      (i "Wedding Rings"    "/collections/wedding-rings"),
      (i "Necklaces"        "/collections/necklaces-pendants"),
      (i "Earrings"         "/collections/earrings"),
      (i "Bracelets"        "/collections/bracelets"),
      (i "Fashion Rings"    "/collections/fashion-rings")
    )),
    (i "Stone Type" "/" @(
      (i "Lab Grown Diamonds" "/collections/lab-grown-diamonds"),
      (i "Moissanite"         "/collections/moissanite")
    ))
  )),

  (i "Jewelry" "/" @(
    (i "Jewelry" "/" @(
      (i "Earrings"             "/collections/earrings"),
      (i "Necklaces & Pendants" "/collections/necklaces-pendants"),
      (i "Bracelets"            "/collections/bracelets"),
      (i "Fashion Rings"        "/collections/fashion-rings"),
      (i "Brides Jewelry"       "/collections/brides-jewelry")
    )),
    (i "Shop By Style" "/" @(
      (i "Tennis Necklaces"       "/collections/tennis-necklaces"),
      (i "Tennis Bracelets"       "/collections/tennis-bracelets"),
      (i "Diamond Studs Earrings" "/collections/studs"),
      (i "Stacking Rings"         "/collections/stacking-rings"),
      (i "Eternity Rings"         "/collections/eternity-rings"),
      (i "Fashion Rings"          "/collections/fashion-rings")
    )),
    (i "Favorites" "/" @(
      (i "Best Sellers"                "/collections/best-sellers"),
      (i "New Arrivals"                "/collections/new-arrivals"),
      (i "Jewelry Trends"              "/collections/jewelry-trends"),
      (i "Brides Jewelry"              "/collections/brides-jewelry"),
      (i "Book a Private Consultation" "/pages/consultation"),
      (i "Customize Your Ring"         "/pages/customize")
    ))
  )),

  (i "Moissanite" "/collections/moissanite" @(
    (i "Shop by Shape" "/" @(
      (i "Oval"      "/collections/oval-moissanite"),
      (i "Pear"      "/collections/pear-moissanite"),
      (i "Round"     "/collections/round-moissanite"),
      (i "Radiant"   "/collections/radiant-moissanite"),
      (i "Emerald"   "/collections/emerald-moissanite"),
      (i "Marquise"  "/collections/marquise-moissanite"),
      (i "Cushion"   "/collections/cushion-moissanite"),
      (i "Princess"  "/collections/princess-moissanite"),
      (i "Asscher"   "/collections/asscher-moissanite"),
      (i "Heart"     "/collections/heart-moissanite")
    )),
    (i "Shop by Style" "/" @(
      (i "Solitaire"   "/collections/solitaire-moissanite"),
      (i "Three Stone" "/collections/three-stone-moissanite"),
      (i "Side Stones" "/collections/side-stones-moissanite"),
      (i "Hidden Halo" "/collections/hidden-halo-moissanite"),
      (i "Halo"        "/collections/halo-moissanite"),
      (i "Double Halo" "/collections/double-halo-moissanite"),
      (i "Bridal Sets" "/collections/bridal-set-moissanite")
    )),
    (i "Lab Grown Jewelry" "/" @(
      (i "Earrings"       "/collections/earrings"),
      (i "Necklaces"      "/collections/necklaces-pendants"),
      (i "Bracelets"      "/collections/bracelets"),
      (i "Fashion Rings"  "/collections/fashion-rings"),
      (i "Brides Jewelry" "/collections/brides-jewelry")
    )),
    (i "Favorites" "/" @(
      (i "Best Sellers"                "/collections/best-sellers"),
      (i "New Arrivals"                "/collections/new-arrivals"),
      (i "Customize Your Ring"         "/pages/customize"),
      (i "Book a Private Consultation" "/pages/consultation"),
      (i "Find my Ring Size"           "/pages/ring-size"),
      (i "Moissanite Guide"            "/pages/moissanite-guide"),
      (i "Moissanite VS Diamond Price" "/pages/moissanite-vs-diamond"),
      (i "What is Moissanite"          "/pages/what-is-moissanite"),
      (i "Moissanite VS Lab Diamonds"  "/pages/moissanite-vs-lab"),
      (i "Lab VS Natural"              "/pages/lab-vs-natural")
    ))
  )),

  (i "About Us" "/" @(
    (i "About Us" "/" @(
      (i "Our Story"   "/pages/our-story"),
      (i "Reviews"     "/pages/reviews"),
      (i "Our Couples" "/pages/our-couples"),
      (i "Our Package" "/pages/our-package")
    )),
    (i "Our Services" "/" @(
      (i "Shipping & Returns"   "/pages/shipping"),
      (i "Payment Options"      "/pages/payment"),
      (i "Warranty"             "/pages/warranty"),
      (i "Repairs"              "/pages/repairs"),
      (i "Free Engraving"       "/pages/engraving"),
      (i "Custom Design"        "/pages/custom-design"),
      (i "Private Consultation" "/pages/consultation")
    ))
  )),

  (i "Education" "/" @(
    (i "Tools & Information" "/" @(
      (i "Financing Options"  "/pages/financing"),
      (i "Ring Size"          "/pages/ring-size"),
      (i "Certificates"       "/pages/certificates"),
      (i "Shipping & Returns" "/pages/shipping"),
      (i "Warranty"           "/pages/warranty"),
      (i "FAQs"               "/pages/faqs")
    )),
    (i "Guides" "/" @(
      (i "Buyers Guide"                          "/pages/buyers-guide"),
      (i "Engagement Ring Styles"                "/pages/ring-styles"),
      (i "Diamond Carat Guide"                   "/pages/carat-guide"),
      (i "Lab Grown Diamonds"                    "/pages/lab-grown-diamonds"),
      (i "Diamond Shapes Guide"                  "/pages/diamond-shape-guide"),
      (i "Metal Type Guide"                      "/pages/metal-type-guide"),
      (i "Wedding Rings Guide"                   "/pages/wedding-rings-guide"),
      (i "How to Match the Perfect Wedding Band" "/pages/match-wedding-band"),
      (i "Engraving Inspiration"                 "/pages/engraving"),
      (i "Lab VS Natural"                        "/pages/lab-vs-natural")
    ))
  ))
)

# Correct mutation format: title and items as direct arguments (NOT inside input:{})
$mutation = @"
mutation menuUpdate(`$id: ID!, `$title: String!, `$items: [MenuItemUpdateInput!]!) {
  menuUpdate(id: `$id, title: `$title, items: `$items) {
    menu { id title }
    userErrors { field message }
  }
}
"@

$variables = @{
    id    = $menuGID
    title = "Main menu"
    items = $menuItems
}

$body = @{ query = $mutation; variables = $variables } | ConvertTo-Json -Depth 20 -Compress

Write-Host "Sending corrected menu update..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "https://$store/admin/api/2024-01/graphql.json" -Headers $headers -Method POST -Body $body

if ($response.errors) {
    Write-Host "GraphQL errors:" -ForegroundColor Red
    $response.errors | ForEach-Object { Write-Host "  $($_.message)" -ForegroundColor Red }
} elseif ($response.data.menuUpdate.userErrors.Count -gt 0) {
    Write-Host "User errors:" -ForegroundColor Red
    $response.data.menuUpdate.userErrors | ForEach-Object { Write-Host "  $($_.field): $($_.message)" -ForegroundColor Red }
} else {
    Write-Host "SUCCESS! Menu updated." -ForegroundColor Green
    Write-Host "Response: $($response.data.menuUpdate | ConvertTo-Json -Compress)" -ForegroundColor Gray
}
