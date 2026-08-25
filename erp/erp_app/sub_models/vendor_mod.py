from .vendor import Vendor


class VendorInfo(Vendor):
	class Meta:
		proxy = True
		verbose_name = "Vendor"
		verbose_name_plural = "Vendors"

