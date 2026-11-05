export const apiResponse = {
  success: (res, { statusCode = 200, message = 'Success', data = null, meta = null, pagination = null }) => {
    const response = {
      success: true,
      message,
      data,
    };

    if (pagination !== null && pagination !== undefined) {
      response.pagination = pagination;
    }

    if (meta !== null && meta !== undefined) {
      response.meta = meta;
    }

    return res.status(statusCode).json(response);
  },

  created: (res, { message = 'Resource created successfully', data = null, meta = null }) => {
    return apiResponse.success(res, { statusCode: 201, message, data, meta });
  },

  paginated: (res, { message = 'Success', data = [], page = 1, limit = 10, total = 0, totalPages = null }) => {
    const pageInfo = {
      page,
      limit,
      total,
      totalPages: totalPages !== null ? totalPages : Math.ceil(total / limit),
    };
    return apiResponse.success(res, {
      message,
      data,
      meta: pageInfo,
      pagination: pageInfo,
    });
  },

  noContent: (res) => {
    return res.status(204).send();
  },
};

export default apiResponse;

