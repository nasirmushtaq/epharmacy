// Role-based access control middleware

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }
};

const pharmacistOnly = (req, res, next) => {
  if (req.user && req.user.role === 'pharmacist') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Pharmacist role required.'
    });
  }
};

const customerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'customer') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Customer role required.'
    });
  }
};

const deliveryAgentOnly = (req, res, next) => {
  if (req.user && req.user.role === 'delivery_agent') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Delivery agent role required.'
    });
  }
};

const adminOrPharmacist = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'pharmacist')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin or pharmacist role required.'
    });
  }
};

const adminOrCustomer = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'customer')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin or customer role required.'
    });
  }
};

const adminOrDeliveryAgent = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'delivery_agent')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin or delivery agent role required.'
    });
  }
};

module.exports = {
  adminOnly,
  pharmacistOnly,
  customerOnly,
  deliveryAgentOnly,
  adminOrPharmacist,
  adminOrCustomer,
  adminOrDeliveryAgent
};
